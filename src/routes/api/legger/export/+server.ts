import db from '$lib/server/db';
import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import { tableKelas } from '$lib/server/db/schema';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { buildLeggerKelas, buildLeggerMurid } from '$lib/server/legger';
import { loadKonfigurasiNilai } from '$lib/server/nilai-sumatif';
import { and, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { isAuthorizedUser } from '../../../pengguna/permissions';

/** 1 -> A, 2 -> B, ... 27 -> AA (used for merge ranges). */
function colLetter(index: number) {
	let n = index;
	let s = '';
	while (n > 0) {
		s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

function slugText(nama: string) {
	return (
		nama
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'legger'
	);
}

type StyledWorksheet = {
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

const THIN_BORDER = { style: 'thin' as const, color: { argb: 'FF000000' } };
const CELL_BORDER = {
	top: THIN_BORDER,
	left: THIN_BORDER,
	bottom: THIN_BORDER,
	right: THIN_BORDER
};

export async function GET({ locals, url }) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		return new Response('Sekolah tidak ditemukan', { status: 401 });
	}
	if (!isAuthorizedUser(['administrasi_legger'], locals.user)) {
		return new Response('Kamu tidak memiliki izin mengunduh Legger.', { status: 403 });
	}

	const paramKelas = url.searchParams.get('kelas') ?? url.searchParams.get('kelas_id');
	const kelasId = Number(paramKelas);
	if (!paramKelas || !Number.isInteger(kelasId) || kelasId <= 0) {
		return new Response('Kelas tidak ditemukan', { status: 400 });
	}

	const allowed = await canAccessKelas(locals.user, sekolahId, kelasId);
	if (!allowed) {
		return new Response('Kamu tidak memiliki akses ke kelas ini.', { status: 403 });
	}

	const kelas = await db.query.tableKelas.findFirst({
		columns: { id: true, nama: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelas) {
		return new Response('Kelas tidak ditemukan', { status: 400 });
	}

	await ensureAsesmenSumatifSchema();
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const bobot = konfigurasi.bobotAkhir;

	const { Workbook } = ExcelJS;
	const workbook = new Workbook();

	const rawMode = url.searchParams.get('mode');
	const rawMurid = url.searchParams.get('murid');
	const muridId = Number(rawMurid) || null;
	const waktuParam = url.searchParams.get('waktu');

	if (rawMode === 'murid' || muridId != null) {
		const { detail } = await buildLeggerMurid({
			sekolahId,
			kelasId,
			muridId,
			waktuParam,
			bobot
		});
		if (!detail) {
			return new Response('Data murid tidak ditemukan pada kelas ini.', { status: 404 });
		}

		const worksheet = workbook.addWorksheet('Legger Murid');
		const semesterCols = detail.riwayatTampil.map((r) => {
			const tingkatTag =
				r.tingkat === 'X' || r.tingkat === 'XI' || r.tingkat === 'XII'
					? `Kelas ${r.tingkat} - `
					: '';
			return `${tingkatTag}${r.kelasNama}\n(${r.semesterLabel})`;
		});
		const totalCols = 3 + semesterCols.length + 1;

		worksheet.addRow([`LEGER NILAI MURID - ${detail.murid.nama.toUpperCase()}`]);
		worksheet.addRow([
			`NIS / NISN: ${detail.murid.nis || '-'} / ${detail.murid.nisn || '-'}   |   Kelas Acuan: ${detail.murid.kelasNama}`
		]);
		worksheet.addRow([]);
		worksheet.addRow(['No', 'Mata Pelajaran', 'Kelompok', ...semesterCols, 'Rata-rata']);

		for (const [idx, row] of detail.barisMapel.entries()) {
			const cells = row.sel.map((s) => (s.diambil ? (s.nilaiAkhir ?? '') : '-'));
			worksheet.addRow([idx + 1, row.nama, row.jenisLabel ?? '-', ...cells, row.rataRata ?? '']);
		}

		worksheet.addRow([
			'',
			'Jumlah Nilai',
			'',
			...detail.riwayatTampil.map((r) => (r.terisi > 0 ? r.jumlahNilai : '')),
			detail.totalTerisiKumulatif > 0 ? detail.totalNilaiKumulatif : ''
		]);
		worksheet.addRow([
			'',
			'Rata-rata Semester',
			'',
			...detail.riwayatTampil.map((r) => r.rataRata ?? ''),
			detail.rataKumulatif ?? ''
		]);
		worksheet.addRow([
			'',
			'Ketidakhadiran (S / I / A)',
			'',
			...detail.riwayatTampil.map((r) => `${r.sakit} / ${r.izin} / ${r.alfa}`),
			`${detail.totalKehadiran.sakit} / ${detail.totalKehadiran.izin} / ${detail.totalKehadiran.alfa}`
		]);

		const ws = worksheet as unknown as StyledWorksheet;
		ws.getColumn(1).width = 5;
		ws.getColumn(2).width = 36;
		ws.getColumn(3).width = 16;
		for (let c = 4; c <= totalCols; c++) {
			ws.getColumn(c).width = 20;
		}

		const titleRow = ws.getRow(1);
		titleRow.height = 24;
		titleRow.font = { bold: true, size: 13 };
		titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
		if (totalCols > 1) ws.mergeCells(`A1:${colLetter(totalCols)}1`);

		const subRow = ws.getRow(2);
		subRow.font = { size: 10 };
		subRow.alignment = { horizontal: 'center', vertical: 'middle' };
		if (totalCols > 1) ws.mergeCells(`A2:${colLetter(totalCols)}2`);

		const headerRow = ws.getRow(4);
		headerRow.height = 32;
		headerRow.font = { bold: true };
		headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

		const lastDataRow = 4 + detail.barisMapel.length + 3;
		for (let r = 4; r <= lastDataRow; r++) {
			const row = ws.getRow(r);
			const isSummary = r > 4 + detail.barisMapel.length;
			if (isSummary) {
				row.font = { bold: true };
				row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
			}
			for (let c = 1; c <= totalCols; c++) {
				const cell = row.getCell(c);
				cell.border = CELL_BORDER;
				cell.alignment =
					c === 2 && r > 4
						? { horizontal: 'left' as const, vertical: 'middle' as const }
						: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
			}
		}

		const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;
		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="legger-${slugText(detail.murid.nama)}-${slugText(detail.murid.kelasNama)}.xlsx"`
			}
		});
	}

	// Class grid Excel export
	const { kolom, baris } = await buildLeggerKelas({ sekolahId, kelasId, bobot });
	const totalCols = 3 + kolom.length + 1;
	const worksheet = workbook.addWorksheet('Legger Kelas');

	worksheet.addRow([`LEGER NILAI KELAS - ${kelas.nama}`]);
	worksheet.addRow([]);
	worksheet.addRow(['No', 'NISN', 'Nama Murid', ...kolom.map((col) => col.nama), 'Rata-rata']);

	for (const [index, row] of baris.entries()) {
		const cells = row.sel.map((v) => v ?? '');
		worksheet.addRow([index + 1, row.nisn, row.nama, ...cells, row.rataRata ?? '']);
	}

	const ws = worksheet as unknown as StyledWorksheet;
	const widths = [5, 16, 32];
	for (let c = 1; c <= totalCols; c++) {
		ws.getColumn(c).width = widths[c - 1] ?? 14;
	}

	const titleRow = ws.getRow(1);
	titleRow.height = 22;
	titleRow.font = { bold: true, size: 14 };
	titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
	if (totalCols > 1) ws.mergeCells(`A1:${colLetter(totalCols)}1`);

	const headerRow = ws.getRow(3);
	headerRow.font = { bold: true };
	headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

	for (let r = 3; r <= 3 + baris.length; r++) {
		const row = ws.getRow(r);
		for (let c = 1; c <= totalCols; c++) {
			const cell = row.getCell(c);
			cell.border = CELL_BORDER;
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
			'Content-Disposition': `attachment; filename="legger-kelas-${slugText(kelas.nama)}.xlsx"`
		}
	});
}
