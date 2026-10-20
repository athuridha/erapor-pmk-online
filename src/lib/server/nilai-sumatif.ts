import db from '$lib/server/db';
import { tableSekolah } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Perhitungan nilai akhir sumatif dan RTS.
 *
 * Semua bobot dan ambang kriteria diambil dari database (tabel `sekolah` dan
 * `kelas`), jadi mengubah pengaturan di halaman sekolah/akademik langsung
 * memengaruhi nilai yang tampil di rapor maupun rekap.
 */

export interface BobotSumatif {
	lingkup: number;
	sts: number;
	sas: number;
}

export interface BobotSumatifRts {
	lingkup: number;
	sts: number;
}

export interface KonfigurasiNilai {
	bobotAkhir: BobotSumatif;
	bobotRts: BobotSumatifRts;
	kriteriaCukup: number;
	kriteriaBaik: number;
}

export const DEFAULT_BOBOT_SUMATIF: BobotSumatif = { lingkup: 60, sts: 20, sas: 20 };
export const DEFAULT_BOBOT_SUMATIF_RTS: BobotSumatifRts = { lingkup: 70, sts: 30 };
export const DEFAULT_KRITERIA_CUKUP = 85;
export const DEFAULT_KRITERIA_BAIK = 95;

type SekolahConfig = {
	sumatifBobotLingkup?: number | null;
	sumatifBobotSts?: number | null;
	sumatifBobotSas?: number | null;
	sumatifBobotRtsLingkup?: number | null;
	sumatifBobotRtsSts?: number | null;
	raporKriteriaCukup?: number | null;
	raporKriteriaBaik?: number | null;
} | null;

export function konfigurasiNilaiDariSekolah(sekolah: SekolahConfig): KonfigurasiNilai {
	return {
		bobotAkhir: {
			lingkup: Number(sekolah?.sumatifBobotLingkup ?? DEFAULT_BOBOT_SUMATIF.lingkup),
			sts: Number(sekolah?.sumatifBobotSts ?? DEFAULT_BOBOT_SUMATIF.sts),
			sas: Number(sekolah?.sumatifBobotSas ?? DEFAULT_BOBOT_SUMATIF.sas)
		},
		bobotRts: {
			lingkup: Number(sekolah?.sumatifBobotRtsLingkup ?? DEFAULT_BOBOT_SUMATIF_RTS.lingkup),
			sts: Number(sekolah?.sumatifBobotRtsSts ?? DEFAULT_BOBOT_SUMATIF_RTS.sts)
		},
		kriteriaCukup: Number(sekolah?.raporKriteriaCukup ?? DEFAULT_KRITERIA_CUKUP),
		kriteriaBaik: Number(sekolah?.raporKriteriaBaik ?? DEFAULT_KRITERIA_BAIK)
	};
}

/** Ambil konfigurasi nilai sekolah langsung dari database. */
export async function loadKonfigurasiNilai(sekolahId: number): Promise<KonfigurasiNilai> {
	const sekolah = await db.query.tableSekolah.findFirst({
		columns: {
			sumatifBobotLingkup: true,
			sumatifBobotSts: true,
			sumatifBobotSas: true,
			sumatifBobotRtsLingkup: true,
			sumatifBobotRtsSts: true,
			raporKriteriaCukup: true,
			raporKriteriaBaik: true
		},
		where: eq(tableSekolah.id, sekolahId)
	});
	return konfigurasiNilaiDariSekolah(sekolah ?? null);
}

function bulatkan(nilai: number) {
	return Math.round(nilai * 100) / 100;
}

/**
 * Nilai akhir sumatif dari komponen lingkup/STS/SAS memakai bobot sekolah.
 * Bila STS belum diisi, dipakai pembagian cadangan lingkup 70% + SAS 30%
 * (sama seperti halaman formulir asesmen sumatif).
 */
export function hitungNilaiAkhirSumatif(
	komponen: { naLingkup: number | null; sts: number | null; sas: number | null },
	bobot: BobotSumatif = DEFAULT_BOBOT_SUMATIF
): number | null {
	const bobotEfektif = komponen.sts == null ? { lingkup: 70, sts: 0, sas: 30 } : bobot;
	let jumlah = 0;
	let bobotTerpakai = 0;
	if (komponen.naLingkup != null) {
		jumlah += komponen.naLingkup * bobotEfektif.lingkup;
		bobotTerpakai += bobotEfektif.lingkup;
	}
	if (komponen.sts != null) {
		jumlah += komponen.sts * bobotEfektif.sts;
		bobotTerpakai += bobotEfektif.sts;
	}
	if (komponen.sas != null) {
		jumlah += komponen.sas * bobotEfektif.sas;
		bobotTerpakai += bobotEfektif.sas;
	}
	if (bobotTerpakai <= 0) return null;
	return bulatkan(jumlah / bobotTerpakai);
}

/** Nilai akhir RTS: lingkup + STS saja, tanpa SAS. */
export function hitungNilaiAkhirRts(
	komponen: { naLingkup: number | null; sts: number | null },
	bobot: BobotSumatifRts = DEFAULT_BOBOT_SUMATIF_RTS
): number | null {
	let jumlah = 0;
	let bobotTerpakai = 0;
	if (komponen.naLingkup != null) {
		jumlah += komponen.naLingkup * bobot.lingkup;
		bobotTerpakai += bobot.lingkup;
	}
	if (komponen.sts != null) {
		jumlah += komponen.sts * bobot.sts;
		bobotTerpakai += bobot.sts;
	}
	if (bobotTerpakai <= 0) return null;
	return bulatkan(jumlah / bobotTerpakai);
}
