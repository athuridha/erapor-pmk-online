import db from '$lib/server/db';
import { daftarKelasSekolah } from '$lib/admin/rekap.server';
import { resolveKelasKonten } from '$lib/server/kelas-akses';
import { isKeluargaAgama, isKeluargaPks, namaVarianUntukMurid } from '$lib/server/mapel-picker';
import { agamaParentName, pksParentName } from '$lib/statics';
import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import {
	hitungNilaiAkhirSumatif,
	loadKonfigurasiNilai,
	type BobotSumatif
} from '$lib/server/nilai-sumatif';
import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { tableAsesmenSumatif, tableMataPelajaran, tableMurid } from '$lib/server/db/schema';
import { isAdminUser, isAuthorizedUser } from '../../pengguna/permissions';
import type { PageServerLoad } from './$types';

/** One grid column: a plain mapel or the per-agama variant family (merged). */
type KolomLegger = {
	key: string;
	mapelId: number | null;
	keluarga: 'agama' | 'pks' | null;
	nama: string;
	singkatan: string;
};

type BarisLegger = {
	muridId: number;
	nama: string;
	nisn: string;
	/** One final-grade value per column from `kolom`. */
	sel: (number | null)[];
};

type MapelRow = {
	id: number;
	kelasId: number;
	nama: string;
	kode: string | null;
	urutan: number | null;
};

type MuridRow = {
	id: number;
	kelasId: number;
	nama: string;
	nisn: string;
	agama: string | null;
};

const normText = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** Short column header: `mata_pelajaran.kode` if set, else initials of up to 3 words. */
function singkatanMapel(row: MapelRow) {
	const kode = (row.kode ?? '').trim();
	if (kode) return kode;
	const initials = row.nama
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 3)
		.map((word) => word.charAt(0).toUpperCase())
		.join('');
	return initials || row.nama.slice(0, 6);
}

function urutanMapel(a: MapelRow, b: MapelRow) {
	return (
		(a.urutan ?? Number.POSITIVE_INFINITY) - (b.urutan ?? Number.POSITIVE_INFINITY) ||
		a.nama.localeCompare(b.nama, 'id')
	);
}

/** Column list for a class: agama/PKS variants merge into a single column each. */
function kolomMapelKelas(rows: MapelRow[]): KolomLegger[] {
	const terurut = [...rows].sort(urutanMapel);
	const kolom: KolomLegger[] = [];
	for (const row of terurut) {
		if (isKeluargaAgama(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'agama')) {
				kolom.push({
					key: 'keluarga-agama',
					mapelId: null,
					keluarga: 'agama',
					nama: agamaParentName,
					singkatan: 'AGM'
				});
			}
			continue;
		}
		if (isKeluargaPks(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'pks')) {
				kolom.push({
					key: 'keluarga-pks',
					mapelId: null,
					keluarga: 'pks',
					nama: pksParentName,
					singkatan: 'PKS'
				});
			}
			continue;
		}
		kolom.push({
			key: `mapel-${row.id}`,
			mapelId: row.id,
			keluarga: null,
			nama: row.nama,
			singkatan: singkatanMapel(row)
		});
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
	const target = normText(namaVarianUntukMurid(baseName, agama));
	return (
		familyRows.find((row) => normText(row.nama) === target)?.id ??
		familyRows.find((row) => normText(row.nama) === normText(baseName))?.id ??
		familyRows[0]?.id ??
		null
	);
}

function barisLeggerKelas(
	muridKelas: MuridRow[],
	kolom: KolomLegger[],
	mapelKelas: MapelRow[],
	nilai: Map<string, number | null>
): BarisLegger[] {
	const agamaRows = mapelKelas.filter((row) => isKeluargaAgama(row.nama));
	const pksRows = mapelKelas.filter((row) => isKeluargaPks(row.nama));
	const terpetakan = muridKelas.map((murid) => ({
		murid,
		agamaId: idVarianMurid(agamaRows, agamaParentName, murid.agama),
		pksId: idVarianMurid(pksRows, pksParentName, murid.agama)
	}));
	return terpetakan.map(({ murid, agamaId, pksId }) => ({
		muridId: murid.id,
		nama: murid.nama,
		nisn: murid.nisn,
		sel: kolom.map((col) => {
			const mapelId =
				col.keluarga === 'agama' ? agamaId : col.keluarga === 'pks' ? pksId : col.mapelId;
			if (mapelId == null) return null;
			return nilai.get(`${murid.id}|${mapelId}`) ?? null;
		})
	}));
}

function hitungKelengkapan(baris: BarisLegger[], kolom: KolomLegger[]) {
	const terisi = baris.reduce((acc, row) => acc + row.sel.filter((v) => v != null).length, 0);
	const total = baris.length * kolom.length;
	const persentase = total > 0 ? Math.round((terisi / total) * 100) : null;
	return { terisi, total, persentase };
}

export const load: PageServerLoad = async ({ parent, locals, url, depends }) => {
	depends('app:legger');
	const meta: PageMeta = { title: 'Legger' };

	if (!isAuthorizedUser(['administrasi_legger'], locals.user)) {
		error(403, 'Kamu tidak memiliki izin membuka halaman Legger.');
	}

	const empty = {
		meta,
		kelasId: null,
		kelas: null,
		daftarKelas: [],
		kolom: [],
		baris: [] as BarisLegger[],
		rekap: { terisi: 0, total: 0, persentase: null },
		kelengkapanKelas: []
	};

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) return empty;

	const { kelasAktif, academicContext } = await parent();
	const user = locals.user;
	const semesterId = academicContext?.activeSemesterId ?? null;

	const paramKelasId = Number(url.searchParams.get('kelas')) || null;
	// ?kelas= per page without touching the global kelasAktif cookie
	let kelasDipilih = await resolveKelasKonten(
		user ?? undefined,
		sekolahId,
		paramKelasId,
		kelasAktif ? { id: kelasAktif.id, nama: kelasAktif.nama, fase: kelasAktif.fase } : null,
		semesterId
	);

	const semuaKelas = await daftarKelasSekolah(sekolahId);
	if (!kelasDipilih) {
		if (isAdminUser(user)) {
			const aktif = semuaKelas.filter((k) => k.semesterId === semesterId);
			kelasDipilih = aktif[0] ?? semuaKelas[0] ?? null;
		}
	}

	const daftarKelas = [...semuaKelas];

	await ensureAsesmenSumatifSchema();
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const bobot: BobotSumatif = konfigurasi.bobotAkhir;

	const muridRows = await db.query.tableMurid.findMany({
		columns: { id: true, kelasId: true, nama: true, nisn: true, agama: true },
		where: eq(tableMurid.sekolahId, sekolahId),
		orderBy: asc(tableMurid.nama)
	});
	const sekolahKelasIds = semuaKelas.map((k) => k.id);
	const mapelRows = sekolahKelasIds.length
		? await db.query.tableMataPelajaran.findMany({
				columns: { id: true, kelasId: true, nama: true, kode: true, urutan: true },
				where: inArray(tableMataPelajaran.kelasId, sekolahKelasIds)
			})
		: [];

	const muridPerKelas = new Map<number, MuridRow[]>();
	for (const murid of muridRows) {
		const list = muridPerKelas.get(murid.kelasId) ?? [];
		list.push(murid);
		muridPerKelas.set(murid.kelasId, list);
	}
	const mapelPerKelas = new Map<number, MapelRow[]>();
	for (const mapel of mapelRows) {
		const list = mapelPerKelas.get(mapel.kelasId) ?? [];
		list.push(mapel);
		mapelPerKelas.set(mapel.kelasId, list);
	}

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

	// Copied & adjusted from nilai-akhir/rekap-keseluruhan: recompute the final
	// grade from lingkup/STS/SAS with school weights, falling back to the stored
	// nilaiAkhir when components are empty.
	const nilaiSel = new Map<string, number | null>();
	for (const row of sumatifRows) {
		const nilai =
			hitungNilaiAkhirSumatif({ naLingkup: row.naLingkup, sts: row.sts, sas: row.sas }, bobot) ??
			row.nilaiAkhir;
		nilaiSel.set(`${row.muridId}|${row.mataPelajaranId}`, nilai ?? null);
	}

	const kelengkapanKelas = semuaKelas.map((kelas) => {
		const kolomKelas = kolomMapelKelas(mapelPerKelas.get(kelas.id) ?? []);
		const muridKelas = muridPerKelas.get(kelas.id) ?? [];
		const baris = barisLeggerKelas(
			muridKelas,
			kolomKelas,
			mapelPerKelas.get(kelas.id) ?? [],
			nilaiSel
		);
		return {
			kelasId: kelas.id,
			nama: kelas.nama,
			...hitungKelengkapan(baris, kolomKelas)
		};
	});

	if (!kelasDipilih) return { ...empty, daftarKelas, kelengkapanKelas };

	const mapelSel = mapelPerKelas.get(kelasDipilih.id) ?? [];
	const kolom = kolomMapelKelas(mapelSel);
	const baris = barisLeggerKelas(
		muridPerKelas.get(kelasDipilih.id) ?? [],
		kolom,
		mapelSel,
		nilaiSel
	);
	const rekap = hitungKelengkapan(baris, kolom);

	return {
		meta,
		kelasId: kelasDipilih.id,
		kelas: { id: kelasDipilih.id, nama: kelasDipilih.nama, fase: kelasDipilih.fase ?? null },
		daftarKelas,
		kolom,
		baris,
		rekap,
		kelengkapanKelas
	};
};
