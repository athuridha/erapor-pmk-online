/**
 * Kustomisasi cetak: teks, gambar, dan jarak/layout untuk dokumen PDF.
 *
 * Pengaturan disimpan sebagai satu JSON di `app_meta` (key `cetak.custom`)
 * supaya tidak perlu tabel baru dan ikut terbawa saat backup database.
 */

import { eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableAppMeta } from '$lib/server/db/schema';

export const DOKUMEN_CETAK = ['cover', 'biodata', 'rapor', 'piagam'] as const;
export type DokumenCetak = (typeof DOKUMEN_CETAK)[number];

export const LABEL_DOKUMEN: Record<DokumenCetak, string> = {
	cover: 'Cover',
	biodata: 'Biodata Murid',
	rapor: 'Rapor',
	piagam: 'Piagam'
};

export interface CustomLayout {
	/** Margin halaman, contoh "20mm". */
	margin: string;
	/** Ukuran font dasar, contoh "11pt". */
	fontSize: string;
	/** Jarak antar baris, contoh "1.4". */
	lineHeight: string;
	/** Lebar logo kop, contoh "70px". */
	logoWidth: string;
	/** Lebar watermark, contoh "45%". */
	watermarkWidth: string;
	/** Opasitas watermark 0-1. */
	watermarkOpacity: number;
	/** Padding sel tabel (px). Kosong = pakai padding bawaan template. */
	cellPadding: string;
}

export interface CustomGambar {
	/** Logo kop (data URL). */
	logo: string | null;
	/** Gambar watermark (data URL). */
	watermark: string | null;
}

export interface CustomTeks {
	/** Nama sekolah pada kop (kosong = pakai data master sekolah). */
	namaSekolah: string;
	/** NPSN pada kop (kosong = pakai data master sekolah). */
	npsn: string;
	/** Alamat sekolah pada kop (kosong = pakai data master sekolah). */
	alamat: string;
	/** Email sekolah pada kop (kosong = pakai data master sekolah). */
	email: string;
	/** Kota penutup (kosong = pakai data master sekolah). */
	kota: string;
	/** Label sebelum tanda tangan kepala sekolah. */
	labelMengetahui: string;
	/** Tanggal penutup manual (kosong = tanggal rapor/bagi rapor). */
	tanggal: string;
	/** Judul tiap dokumen. */
	judul: Record<DokumenCetak, string>;
	/** Subjudul tiap dokumen. */
	subjudul: Record<DokumenCetak, string>;
	/** Baris kop tiap dokumen (mis. nama Kementerian, REPUBLIK INDONESIA). */
	kopBaris: Record<DokumenCetak, string[]>;
	/** Catatan kaki tiap dokumen. */
	catatan: Record<DokumenCetak, string>;
	/** Tampilkan foto murid. */
	tampilkanFoto: boolean;
	/** Tampilkan logo di kop dokumen. */
	tampilkanLogo: boolean;
	/** Tampilkan watermark. */
	tampilkanWatermark: boolean;
}

export interface CustomCetak {
	layout: CustomLayout;
	teks: CustomTeks;
	gambar: CustomGambar;
}

const META_KEY = 'cetak.custom';

export const DEFAULT_JUDUL: Record<DokumenCetak, string> = {
	cover: 'LAPORAN',
	biodata: 'IDENTITAS MURID',
	rapor: 'LAPORAN HASIL BELAJAR',
	piagam: ''
};

export const DEFAULT_SUBJUDUL: Record<DokumenCetak, string> = {
	cover: 'HASIL BELAJAR MURID',
	biodata: '',
	rapor: '(RAPOR)',
	piagam: ''
};

export const DEFAULT_CUSTOM_CETAK: CustomCetak = {
	layout: {
		margin: '20mm',
		fontSize: '11pt',
		lineHeight: '1.4',
		logoWidth: '70px',
		watermarkWidth: '45%',
		watermarkOpacity: 0.12,
		cellPadding: ''
	},
	teks: {
		namaSekolah: '',
		npsn: '',
		alamat: '',
		email: '',
		kota: '',
		labelMengetahui: 'Mengetahui',
		tanggal: '',
		judul: { ...DEFAULT_JUDUL },
		subjudul: { ...DEFAULT_SUBJUDUL },
		kopBaris: { cover: [], biodata: [], rapor: [], piagam: [] },
		catatan: { cover: '', biodata: '', rapor: '', piagam: '' },
		tampilkanFoto: true,
		tampilkanLogo: true,
		tampilkanWatermark: true
	},
	gambar: {
		logo: null,
		watermark: null
	}
};

function teks(value: unknown, fallback = ''): string {
	if (typeof value !== 'string') return fallback;
	return value;
}

function bool(value: unknown, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (value === '1' || value === 'true') return true;
	if (value === '0' || value === 'false') return false;
	return fallback;
}

function nomor(value: unknown, fallback: number, min: number, max: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, parsed));
}

/** Gabungkan nilai tersimpan dengan default agar field baru tetap punya nilai. */
export function normalisasiCustomCetak(input: unknown): CustomCetak {
	const raw = (input ?? {}) as Partial<CustomCetak>;
	const layout = (raw.layout ?? {}) as Partial<CustomLayout>;
	const teksRaw = (raw.teks ?? {}) as Partial<CustomTeks> & {
		kopBaris1?: Record<string, unknown>;
		kopBaris2?: Record<string, unknown>;
	};
	const gambar = (raw.gambar ?? {}) as Partial<CustomGambar>;

	const judul = { ...DEFAULT_JUDUL };
	const subjudul = { ...DEFAULT_SUBJUDUL };
	const kopBaris: Record<DokumenCetak, string[]> = {
		cover: [],
		biodata: [],
		rapor: [],
		piagam: []
	};
	const catatan: Record<DokumenCetak, string> = { cover: '', biodata: '', rapor: '', piagam: '' };
	for (const doc of DOKUMEN_CETAK) {
		// Judul/subjudul kosong berarti pakai bawaan template.
		judul[doc] = teks(teksRaw.judul?.[doc]).trim() || DEFAULT_JUDUL[doc];
		subjudul[doc] = teks(teksRaw.subjudul?.[doc]).trim() || DEFAULT_SUBJUDUL[doc];
		const rawLines = teksRaw.kopBaris?.[doc];
		if (Array.isArray(rawLines)) {
			kopBaris[doc] = rawLines
				.filter((line): line is string => typeof line === 'string')
				.map((line) => line.trim())
				.filter(Boolean);
		} else {
			// Migrasi data lama (kopBaris1/kopBaris2) menjadi array.
			kopBaris[doc] = [teks(teksRaw.kopBaris1?.[doc]), teks(teksRaw.kopBaris2?.[doc])]
				.map((line) => line.trim())
				.filter(Boolean);
		}
		catatan[doc] = teks(teksRaw.catatan?.[doc], '');
	}

	return {
		layout: {
			margin: teks(layout.margin, DEFAULT_CUSTOM_CETAK.layout.margin),
			fontSize: teks(layout.fontSize, DEFAULT_CUSTOM_CETAK.layout.fontSize),
			lineHeight: teks(layout.lineHeight, DEFAULT_CUSTOM_CETAK.layout.lineHeight),
			logoWidth: teks(layout.logoWidth, DEFAULT_CUSTOM_CETAK.layout.logoWidth),
			watermarkWidth: teks(layout.watermarkWidth, DEFAULT_CUSTOM_CETAK.layout.watermarkWidth),
			watermarkOpacity: nomor(
				layout.watermarkOpacity,
				DEFAULT_CUSTOM_CETAK.layout.watermarkOpacity,
				0,
				1
			),
			cellPadding: teks(layout.cellPadding, '')
		},
		teks: {
			namaSekolah: teks(teksRaw.namaSekolah),
			npsn: teks(teksRaw.npsn),
			alamat: teks(teksRaw.alamat),
			email: teks(teksRaw.email),
			kota: teks(teksRaw.kota),
			labelMengetahui: teks(teksRaw.labelMengetahui, DEFAULT_CUSTOM_CETAK.teks.labelMengetahui),
			tanggal: teks(teksRaw.tanggal),
			judul,
			subjudul,
			kopBaris,
			catatan,
			tampilkanFoto: bool(teksRaw.tampilkanFoto, true),
			tampilkanLogo: bool(teksRaw.tampilkanLogo, true),
			tampilkanWatermark: bool(teksRaw.tampilkanWatermark, true)
		},
		gambar: {
			logo: typeof gambar.logo === 'string' && gambar.logo.startsWith('data:') ? gambar.logo : null,
			watermark:
				typeof gambar.watermark === 'string' && gambar.watermark.startsWith('data:')
					? gambar.watermark
					: null
		}
	};
}

/** Baca pengaturan kustomisasi cetak dari `app_meta`. */
export async function loadCustomCetak(): Promise<CustomCetak> {
	try {
		const row = await db.query.tableAppMeta.findFirst({ where: eq(tableAppMeta.key, META_KEY) });
		if (!row?.value) return normalisasiCustomCetak({});
		return normalisasiCustomCetak(JSON.parse(row.value));
	} catch (error) {
		console.warn('[cetak-custom] gagal membaca pengaturan:', error);
		return normalisasiCustomCetak({});
	}
}

/** Simpan pengaturan kustomisasi cetak ke `app_meta`. */
export async function simpanCustomCetak(custom: CustomCetak): Promise<void> {
	const value = JSON.stringify(normalisasiCustomCetak(custom));
	const timestamp = new Date().toISOString();
	await db
		.insert(tableAppMeta)
		.values({ key: META_KEY, value, createdAt: timestamp, updatedAt: timestamp })
		.onConflictDoUpdate({ target: tableAppMeta.key, set: { value, updatedAt: timestamp } });
}

/** CSS tambahan untuk mengatur jarak/layout seluruh dokumen cetak. */
export function customCss(custom: CustomCetak): string {
	const { layout } = custom;
	const padding = layout.cellPadding.trim();
	return `
/* — kustomisasi cetak — */
@page {
	margin: ${layout.margin};
}

body {
	font-size: ${layout.fontSize};
	line-height: ${layout.lineHeight};
}

.custom-note {
	margin-top: 8mm;
	font-size: 9pt;
	text-align: center;
}

img.watermark,
img.watermark-cover {
	opacity: ${layout.watermarkOpacity};
	width: ${layout.watermarkWidth};
}

	img.cover-logo,
	img.header-logo,
	img.t2-header-logo,
	img.kop-logo {
		width: ${layout.logoWidth};
		height: auto;
	}
${padding ? `table td, table th { padding: ${padding} !important; }` : ''}
`;
}

/**
 * Terapkan teks/gambar kustom ke data cetak. Nilai kosong berarti pakai
 * data master sekolah, jadi tidak ada perubahan tampilan.
 */
export function terapkanCustom<T extends Record<string, unknown>>(
	data: T,
	custom: CustomCetak,
	docType: DokumenCetak
): T {
	const hasil: Record<string, unknown> = { ...data };
	const sekolah = (hasil.sekolah ?? {}) as Record<string, unknown>;
	const overrideSekolah: Record<string, unknown> = { ...sekolah };

	if (custom.teks.namaSekolah.trim()) overrideSekolah.nama = custom.teks.namaSekolah.trim();
	if (custom.teks.npsn.trim()) overrideSekolah.npsn = custom.teks.npsn.trim();
	if (custom.teks.email.trim()) overrideSekolah.email = custom.teks.email.trim();
	if (custom.teks.alamat.trim()) overrideSekolah.alamat = custom.teks.alamat.trim();

	if (custom.gambar.logo) {
		overrideSekolah.logoSrc = custom.gambar.logo;
		overrideSekolah.logoUrl = custom.gambar.logo;
		overrideSekolah.bgLogoSrc = custom.gambar.logo;
	}
	if (custom.teks.tampilkanWatermark === false) {
		overrideSekolah.bgLogoSrc = null;
	}
	hasil.sekolah = overrideSekolah;

	const ttd = (hasil.ttd ?? {}) as Record<string, unknown>;
	const overrideTtd: Record<string, unknown> = { ...ttd };
	if (custom.teks.kota.trim()) overrideTtd.tempat = custom.teks.kota.trim();
	if (custom.teks.tanggal.trim()) overrideTtd.tanggal = custom.teks.tanggal.trim();
	if (custom.teks.labelMengetahui.trim()) {
		overrideTtd.labelMengetahui = custom.teks.labelMengetahui.trim();
	}
	hasil.ttd = overrideTtd;

	hasil.custom = {
		...custom,
		docType,
		judul: custom.teks.judul[docType] || DEFAULT_JUDUL[docType],
		subjudul: custom.teks.subjudul[docType] || DEFAULT_SUBJUDUL[docType],
		kopBaris: custom.teks.kopBaris[docType] ?? [],
		kopBaris1: custom.teks.kopBaris[docType]?.[0] ?? '',
		kopBaris2: custom.teks.kopBaris[docType]?.[1] ?? '',
		catatan: custom.teks.catatan[docType] || ''
	};

	return hasil as T;
}
