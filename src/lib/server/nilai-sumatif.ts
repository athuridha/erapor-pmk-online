import db from '$lib/server/db';
import { queryInChunks } from '$lib/server/db/chunk';
import {
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan,
	tableMataPelajaran,
	tableSekolah,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Perhitungan nilai akhir penilaian terpadu (Formatif F, Sumatif S, Sumatif AS,
 * Revisi) dan RTS.
 *
 * Bobot default diambil dari tabel `sekolah`, sedangkan tiap `mata_pelajaran`
 * dapat menyimpan bobot sendiri (bobotFormatif / bobotSumatif / bobotAs).
 */

export type JenisAsesmen = 'formatif' | 'sumatif' | 'as';

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

export type SekolahConfig = {
	sumatifBobotLingkup?: number | null;
	sumatifBobotSts?: number | null;
	sumatifBobotSas?: number | null;
	sumatifBobotRtsLingkup?: number | null;
	sumatifBobotRtsSts?: number | null;
	raporKriteriaCukup?: number | null;
	raporKriteriaBaik?: number | null;
} | null;

export type MapelBobotConfig = {
	bobotFormatif?: number | null;
	bobotSumatif?: number | null;
	bobotAs?: number | null;
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

/**
 * Gabungkan bobot per mapel (jika diatur guru) dengan default sekolah.
 */
export function bobotMapelEfektif(
	mapel: MapelBobotConfig | undefined,
	sekolah: KonfigurasiNilai
): {
	bobotAkhir: BobotSumatif;
	bobotRts: BobotSumatifRts;
	isCustom: boolean;
} {
	const hasOverride =
		mapel != null &&
		(mapel.bobotFormatif != null || mapel.bobotSumatif != null || mapel.bobotAs != null);
	if (!hasOverride) {
		return {
			bobotAkhir: sekolah.bobotAkhir,
			bobotRts: sekolah.bobotRts,
			isCustom: false
		};
	}

	const lingkup = Number(mapel.bobotFormatif ?? sekolah.bobotAkhir.lingkup);
	const sts = Number(mapel.bobotSumatif ?? sekolah.bobotAkhir.sts);
	const sas = Number(mapel.bobotAs ?? sekolah.bobotAkhir.sas);
	const bobotAkhir: BobotSumatif = { lingkup, sts, sas };
	const bobotRts: BobotSumatifRts = lingkup + sts > 0 ? { lingkup, sts } : sekolah.bobotRts;

	return { bobotAkhir, bobotRts, isCustom: true };
}

/** Bobot per kolom asesmen: nilai <= 0 diperlakukan sebagai 1 agar TP lama tetap setara. */
export function effectiveColumnBobot(bobot: number | null | undefined): number {
	const num = Number(bobot ?? 0);
	return Number.isFinite(num) && num > 0 ? num : 1;
}

/** Hitung rata-rata berbobot untuk kolom asesmen di dalam satu kelompok (F / S / AS). */
export function hitungRataBerbobot(
	entries: Array<{ nilai: number | null | undefined; bobot?: number | null }>
): number | null {
	let weightedSum = 0;
	let totalWeight = 0;
	for (const entry of entries) {
		if (entry.nilai == null || !Number.isFinite(entry.nilai)) continue;
		const weight = effectiveColumnBobot(entry.bobot);
		weightedSum += entry.nilai * weight;
		totalWeight += weight;
	}
	if (totalWeight <= 0) return null;
	return bulatkan(weightedSum / totalWeight);
}

/** Jika kolom REVISI diisi, nilai tersebut dipakai sebagai nilai akhir efektif. */
export function nilaiEfektifAkhir(
	nilaiAkhirAsli: number | null | undefined,
	nilaiRevisi: number | null | undefined
): number | null {
	if (nilaiRevisi != null && Number.isFinite(nilaiRevisi)) {
		return bulatkan(nilaiRevisi);
	}
	if (nilaiAkhirAsli != null && Number.isFinite(nilaiAkhirAsli)) {
		return bulatkan(nilaiAkhirAsli);
	}
	return null;
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
 * Kontribusi berbobot satu komponen (NA F, NA S, atau NA AS) terhadap nilai akhir,
 * misalnya rata-rata 86 dengan bobot 50 dari total 100 menghasilkan 43.
 */
export function hitungKontribusiKomponen(
	nilai: number | null | undefined,
	bobotKomponen: number,
	totalBobot: number
): number | null {
	if (nilai == null || !Number.isFinite(nilai) || totalBobot <= 0) return null;
	const bobotPositif = Math.max(0, bobotKomponen);
	return bulatkan((nilai * bobotPositif) / totalBobot);
}

/**
 * Nilai akhir dari komponen Formatif (naLingkup), Sumatif (sts), dan Sumatif AS (sas):
 * langsung menjumlahkan kontribusi berbobot NA (F) + NA (S) + NA (AS).
 * Komponen yang belum diisi dihitung 0 selama minimal satu komponen terisi.
 */
export function hitungNilaiAkhirSumatif(
	komponen: { naLingkup: number | null; sts: number | null; sas: number | null },
	bobot: BobotSumatif = DEFAULT_BOBOT_SUMATIF
): number | null {
	const totalBobot = Math.max(0, bobot.lingkup) + Math.max(0, bobot.sts) + Math.max(0, bobot.sas);
	if (totalBobot <= 0) return null;
	const hasAny = komponen.naLingkup != null || komponen.sts != null || komponen.sas != null;
	if (!hasAny) return null;

	const cF = hitungKontribusiKomponen(komponen.naLingkup, bobot.lingkup, totalBobot) ?? 0;
	const cS = hitungKontribusiKomponen(komponen.sts, bobot.sts, totalBobot) ?? 0;
	const cAs = hitungKontribusiKomponen(komponen.sas, bobot.sas, totalBobot) ?? 0;
	return bulatkan(cF + cS + cAs);
}

/** Nilai akhir RTS: kontribusi Formatif (F) + Sumatif (S) saja, tanpa AS. */
export function hitungNilaiAkhirRts(
	komponen: { naLingkup: number | null; sts: number | null },
	bobot: BobotSumatifRts = DEFAULT_BOBOT_SUMATIF_RTS
): number | null {
	const totalBobot = Math.max(0, bobot.lingkup) + Math.max(0, bobot.sts);
	if (totalBobot <= 0) return null;
	const hasAny = komponen.naLingkup != null || komponen.sts != null;
	if (!hasAny) return null;

	const cF = hitungKontribusiKomponen(komponen.naLingkup, bobot.lingkup, totalBobot) ?? 0;
	const cS = hitungKontribusiKomponen(komponen.sts, bobot.sts, totalBobot) ?? 0;
	return bulatkan(cF + cS);
}

/**
 * Hitung ulang seluruh agregat `asesmen_sumatif` (NA F, NA S, NA AS, AKHIR,
 * nilaiAkhir efektif dengan REVISI, dan RTS) untuk satu atau beberapa mapel.
 */
export async function recalcMapelSumatifScores(
	mapelIds: number[],
	sekolah: SekolahConfig
): Promise<void> {
	const uniqueIds = Array.from(new Set(mapelIds.filter((id) => Number.isInteger(id) && id > 0)));
	if (!uniqueIds.length) return;

	const konfigurasiSekolah = konfigurasiNilaiDariSekolah(sekolah);

	const mapelRows = await queryInChunks(uniqueIds, (ids) =>
		db
			.select({
				id: tableMataPelajaran.id,
				bobotFormatif: tableMataPelajaran.bobotFormatif,
				bobotSumatif: tableMataPelajaran.bobotSumatif,
				bobotAs: tableMataPelajaran.bobotAs
			})
			.from(tableMataPelajaran)
			.where(inArray(tableMataPelajaran.id, ids))
	);
	const mapelById = new Map(mapelRows.map((m) => [m.id, m]));

	const tujuanRows = await queryInChunks(uniqueIds, (ids) =>
		db
			.select({
				id: tableTujuanPembelajaran.id,
				mataPelajaranId: tableTujuanPembelajaran.mataPelajaranId,
				jenisAsesmen: tableTujuanPembelajaran.jenisAsesmen,
				bobot: tableTujuanPembelajaran.bobot
			})
			.from(tableTujuanPembelajaran)
			.where(inArray(tableTujuanPembelajaran.mataPelajaranId, ids))
	);

	const tujuanByMapel = new Map<
		number,
		{
			formatif: Array<{ id: number; bobot: number }>;
			sumatif: Array<{ id: number; bobot: number }>;
			as: Array<{ id: number; bobot: number }>;
		}
	>();
	for (const t of tujuanRows) {
		let bucket = tujuanByMapel.get(t.mataPelajaranId);
		if (!bucket) {
			bucket = { formatif: [], sumatif: [], as: [] };
			tujuanByMapel.set(t.mataPelajaranId, bucket);
		}
		const jenis: JenisAsesmen =
			t.jenisAsesmen === 'sumatif' || t.jenisAsesmen === 'as' ? t.jenisAsesmen : 'formatif';
		bucket[jenis].push({ id: t.id, bobot: t.bobot ?? 0 });
	}

	const existingRows = await queryInChunks(uniqueIds, (ids) =>
		db
			.select({
				id: tableAsesmenSumatif.id,
				muridId: tableAsesmenSumatif.muridId,
				mataPelajaranId: tableAsesmenSumatif.mataPelajaranId,
				naLingkup: tableAsesmenSumatif.naLingkup,
				sts: tableAsesmenSumatif.sts,
				sas: tableAsesmenSumatif.sas,
				nilaiAkhirAsli: tableAsesmenSumatif.nilaiAkhirAsli,
				nilaiRevisi: tableAsesmenSumatif.nilaiRevisi,
				nilaiAkhir: tableAsesmenSumatif.nilaiAkhir,
				nilaiAkhirRts: tableAsesmenSumatif.nilaiAkhirRts
			})
			.from(tableAsesmenSumatif)
			.where(inArray(tableAsesmenSumatif.mataPelajaranId, ids))
	);

	const tpScoreRows = await queryInChunks(uniqueIds, (ids) =>
		db
			.select({
				muridId: tableAsesmenSumatifTujuan.muridId,
				mataPelajaranId: tableAsesmenSumatifTujuan.mataPelajaranId,
				tujuanPembelajaranId: tableAsesmenSumatifTujuan.tujuanPembelajaranId,
				nilai: tableAsesmenSumatifTujuan.nilai
			})
			.from(tableAsesmenSumatifTujuan)
			.where(inArray(tableAsesmenSumatifTujuan.mataPelajaranId, ids))
	);

	const scoresByKey = new Map<string, Map<number, number>>();
	for (const r of tpScoreRows) {
		if (r.nilai == null) continue;
		const key = `${r.muridId}|${r.mataPelajaranId}`;
		let map = scoresByKey.get(key);
		if (!map) {
			map = new Map();
			scoresByKey.set(key, map);
		}
		map.set(r.tujuanPembelajaranId, Number(r.nilai));
	}

	const nowIso = new Date().toISOString();

	for (const rec of existingRows) {
		const mapel = mapelById.get(rec.mataPelajaranId);
		const bobot = bobotMapelEfektif(mapel, konfigurasiSekolah);
		const cols = tujuanByMapel.get(rec.mataPelajaranId) ?? {
			formatif: [],
			sumatif: [],
			as: []
		};
		const studentScores = scoresByKey.get(`${rec.muridId}|${rec.mataPelajaranId}`) ?? new Map();

		const naLingkup =
			cols.formatif.length > 0
				? hitungRataBerbobot(
						cols.formatif.map((c) => ({ nilai: studentScores.get(c.id), bobot: c.bobot }))
					)
				: (rec.naLingkup ?? null);
		const sts =
			cols.sumatif.length > 0
				? hitungRataBerbobot(
						cols.sumatif.map((c) => ({ nilai: studentScores.get(c.id), bobot: c.bobot }))
					)
				: (rec.sts ?? null);
		const sas =
			cols.as.length > 0
				? hitungRataBerbobot(
						cols.as.map((c) => ({ nilai: studentScores.get(c.id), bobot: c.bobot }))
					)
				: (rec.sas ?? null);

		const nilaiAkhirAsli = hitungNilaiAkhirSumatif({ naLingkup, sts, sas }, bobot.bobotAkhir);
		const nilaiAkhir = nilaiEfektifAkhir(nilaiAkhirAsli, rec.nilaiRevisi);
		const nilaiAkhirRts = hitungNilaiAkhirRts({ naLingkup, sts }, bobot.bobotRts);

		if (
			naLingkup !== rec.naLingkup ||
			sts !== rec.sts ||
			sas !== rec.sas ||
			nilaiAkhirAsli !== rec.nilaiAkhirAsli ||
			nilaiAkhir !== rec.nilaiAkhir ||
			nilaiAkhirRts !== rec.nilaiAkhirRts
		) {
			await db
				.update(tableAsesmenSumatif)
				.set({
					naLingkup,
					sts,
					sas,
					nilaiAkhirAsli,
					nilaiAkhir,
					nilaiAkhirRts,
					updatedAt: nowIso
				})
				.where(eq(tableAsesmenSumatif.id, rec.id));
		}
	}
}
