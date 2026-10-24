import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableKelas,
	tableMataPelajaran,
	tableMurid
} from '$lib/server/db/schema';
import {
	hitungNilaiAkhirSumatif,
	loadKonfigurasiNilai,
	type BobotSumatif
} from '$lib/server/nilai-sumatif';
import { isKeluargaAgama, isKeluargaPks, namaVarianUntukMurid } from '$lib/server/mapel-picker';
import { agamaParentName, pksParentName } from '$lib/statics';
import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import ExcelJS from 'exceljs';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { isAuthorizedUser } from '../../../pengguna/permissions';

// XLSX export of the Legger grid (one class), mirroring the parsing/calculation
// copied from `(input-nilai)/legger`: final grades recomputed from
// lingkup/STS/SAS with school weights, agama/PKS variant families merged into
// one column each, and per-murid variant resolution by religion.

type MapelRow = { id: number; nama: string; urutan: number | null };
type KolomLegger = { keluarga: 'agama' | 'pks' | null; mapelId: number | null; nama: string };

const normText = (v: string) => v.trim().toLowerCase();

function urutanMapel(a: MapelRow, b: MapelRow) {
	return (
		(a.urutan ?? Number.POSITIVE_INFINITY) - (b.urutan ?? Number.POSITIVE_INFINITY) ||
		a.nama.localeCompare(b.nama, 'id')
	);
}

/** Column list for a class: agama/PKS variants merge into a single column each. */
function kolomMapelKelas(rows: MapelRow[]): KolomLegger[] {
	const kolom: KolomLegger[] = [];
	for (const row of [...rows].sort(urutanMapel)) {
		if (isKeluargaAgama(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'agama')) {
				kolom.push({ keluarga: 'agama', mapelId: null, nama: agamaParentName });
			}
			continue;
		}
		if (isKeluargaPks(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'pks')) {
				kolom.push({ keluarga: 'pks', mapelId: null, nama: pksParentName });
			}
			continue;
		}
		kolom.push({ keluarga: null, mapelId: row.id, nama: row.nama });
	}
	return kolom;
}

/** Variant mapel id for one murid's religion/PKS column (falls back like rekap). */
function idVarianMurid(
	familyRows: MapelRow[],
	baseName: string,
	agama: string | null | undefined
): number | null {
	if (!familyRows.length) return null;
	const target = normText(namaVarianUntukMurid(baseName, agama) ?? '');
	return (
		familyRows.find((row) => normText(row.nama) === target)?.id ??
		familyRows.find((row) => normText(row.nama) === normText(baseName))?.id ??
		familyRows[0]?.id ??
		null
	);
}

/** 1 → A, 2 → B, … 27 → AA (used for merge ranges). */
function colLetter(index: number) {
	let n = index;
	let s = '';
	while (n > 0) {
		s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

function slugKelas(nama: string) {
	return (
		nama
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'kelas'
	);
}

export async function GET({ locals, url }) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		return new Response('Sekolah tidak ditemukan', { status: 401 });
	}
	if (!isAuthorizedUser(['administrasi_legger'], locals.user)) {
		return new Response('Kamu tidak memiliki izin mengunduh Legger.', { status: 403 });
	}

	const paramKelas = url.searchParams.get('kelas');
	const kelasId = Number(paramKelas);
	if (!paramKelas || !Number.isInteger(kelasId) || kelasId <= 0) {
		return new Response('Kelas tidak ditemukan', { status: 400 });
	}

	const kelas = await db.query.tableKelas.findFirst({
		columns: { id: true, nama: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelas) {
		return new Response('Kelas tidak ditemukan', { status: 400 });
	}

	const { Workbook } = ExcelJS;

	await ensureAsesmenSumatifSchema();
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const bobot: BobotSumatif = konfigurasi.bobotAkhir;

	const muridRows = await db.query.tableMurid.findMany({
		columns: { id: true, nama: true, nisn: true, agama: true },
		where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.kelasId, kelas.id)),
		orderBy: asc(tableMurid.nama)
	});
	const mapelRows = await db.query.tableMataPelajaran.findMany({
		columns: { id: true, nama: true, urutan: true },
		where: eq(tableMataPelajaran.kelasId, kelas.id)
	});

	const muridIds = muridRows.map((m) => m.id);
	const mapelIds = mapelRows.map((m) => m.id);
	const sumatifRows =
		muridIds.length && mapelIds.length
			? await db.query.tableAsesmenSumatif.findMany({
					columns: {
						muridId: true,
						mataPelajaranId: true,
						naLingkup: true,
						sts: true,
						sas: true,
						nilaiAkhir: true
					},
					where: and(
						inArray(tableAsesmenSumatif.muridId, muridIds),
						inArray(tableAsesmenSumatif.mataPelajaranId, mapelIds)
					)
				})
			: [];

	// Copied & adjusted from legger page load: recompute the final grade from
	// lingkup/STS/SAS with school weights, falling back to the stored nilaiAkhir
	// when components are empty.
	const nilaiSel = new Map<string, number | null>();
	for (const row of sumatifRows) {
		const nilai =
			hitungNilaiAkhirSumatif({ naLingkup: row.naLingkup, sts: row.sts, sas: row.sas }, bobot) ??
			row.nilaiAkhir;
		nilaiSel.set(`${row.muridId}|${row.mataPelajaranId}`, nilai ?? null);
	}

	const kolom = kolomMapelKelas(mapelRows);
	const agamaRows = mapelRows.filter((row) => isKeluargaAgama(row.nama));
	const pksRows = mapelRows.filter((row) => isKeluargaPks(row.nama));
	const totalCols = 3 + kolom.length;

	const workbook = new Workbook();
	const worksheet = workbook.addWorksheet('Legger');

	worksheet.addRow([`LEGER NILAI — ${kelas.nama}`]);
	worksheet.addRow([]);
	worksheet.addRows([['No', 'NISN', 'Nama Murid', ...kolom.map((col) => col.nama)]]);

	for (const [index, murid] of muridRows.entries()) {
		const agamaId = idVarianMurid(agamaRows, agamaParentName, murid.agama);
		const pksId = idVarianMurid(pksRows, pksParentName, murid.agama);
		const cells: Array<string | number> = kolom.map((col) => {
			const mapelId =
				col.keluarga === 'agama' ? agamaId : col.keluarga === 'pks' ? pksId : col.mapelId;
			if (mapelId == null) return '';
			return nilaiSel.get(`${murid.id}|${mapelId}`) ?? '';
		});
		worksheet.addRows([[index + 1, murid.nisn, murid.nama, ...cells]]);
	}

	// exceljs is CommonJS without bundled types (see $lib/types.d.ts), so styling
	// goes through the same conservative cast as api/cetak/ba.
	const ws = worksheet as unknown as {
		getRow(n: number): {
			height?: number;
			font?: unknown;
			alignment?: unknown;
			fill?: unknown;
			getCell(n: number): {
				border?: unknown;
				font?: unknown;
				fill?: unknown;
				alignment?: unknown;
			};
		};
		getColumn(n: number): { width?: number };
		mergeCells(range: string): void;
	};

	const widths = [5, 16, 32];
	for (let c = 1; c <= totalCols; c++) {
		ws.getColumn(c).width = widths[c - 1] ?? 14;
	}

	const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
	const borderStyle = {
		top: thinBorder,
		left: thinBorder,
		bottom: thinBorder,
		right: thinBorder
	};

	const titleRow = ws.getRow(1);
	titleRow.height = 22;
	titleRow.font = { bold: true, size: 14 };
	titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
	if (totalCols > 1) {
		ws.mergeCells(`A1:${colLetter(totalCols)}1`);
	}

	const headerRow = ws.getRow(3);
	headerRow.font = { bold: true };
	headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

	for (let r = 3; r <= 3 + muridRows.length; r++) {
		const row = ws.getRow(r);
		for (let c = 1; c <= totalCols; c++) {
			const cell = row.getCell(c);
			cell.border = borderStyle;
			cell.alignment =
				c === 3
					? { horizontal: 'left' as const, vertical: 'middle' as const }
					: { horizontal: 'center' as const, vertical: 'middle' as const };
		}
	}

	const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="legger-${slugKelas(kelas.nama)}.xlsx"`
		}
	});
}
