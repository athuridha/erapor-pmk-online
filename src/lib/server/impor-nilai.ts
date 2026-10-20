import db from '$lib/server/db';
import {
	tableAsesmenFormatif,
	tableAsesmenSumatif,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { readBufferToAoA, writeAoaToBuffer } from '$lib/utils/excel.js';
import { catatAudit } from '$lib/server/audit';

export type JenisImpor = 'sumatif' | 'formatif';

export interface OpsiKelasImpor {
	id: number;
	nama: string;
	semesterLabel: string;
}

export interface BarisImpor {
	baris: number;
	muridId: number | null;
	muridNama: string | null;
	nis: string;
	nisn: string;
	/** nilai per mapel (id mapel → nilai) */
	nilai: Map<number, number | boolean>;
	/** daftar pesan error baris ini */
	masalah: string[];
}

export interface HasilImpor {
	ok: boolean;
	jenis: JenisImpor;
	kelasId: number;
	kelasNama: string;
	mapel: Array<{ id: number; nama: string }>;
	baris: BarisImpor[];
	totalNilai: number;
	barisValid: number;
	barisBermasalah: number;
	pesanUmum: string[];
	/** ringkasan per kolom mapel */
	ringkasanMapel: Array<{ mapel: string; terisi: number; rata: number | null }>;
}

function norm(value: unknown) {
	return String(value ?? '')
		.trim()
		.toLowerCase();
}

function parseNilai(raw: unknown): number | null {
	if (raw == null) return null;
	const teks = String(raw).trim();
	if (teks === '') return null;
	const angka = Number(teks.replace(',', '.'));
	if (!Number.isFinite(angka)) return NaN;
	return angka;
}

function parseTuntas(raw: unknown): number | boolean | null {
	if (raw == null) return null;
	const teks = norm(raw);
	if (teks === '') return null;
	if (['y', 'ya', 't', 'true', '1'].includes(teks)) return true;
	if (['n', 'tidak', 'f', 'false', '0'].includes(teks)) return false;
	return NaN;
}

/** Daftar kelas yang bisa diimpor (kelas pada semester aktif/terakhir). */
export async function daftarKelasImpor(sekolahId: number): Promise<OpsiKelasImpor[]> {
	const kelas = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, semesterId: true },
		where: eq(tableKelas.sekolahId, sekolahId),
		orderBy: asc(tableKelas.nama)
	});
	return kelas.map((row) => ({
		id: row.id,
		nama: row.nama,
		semesterLabel: String(row.semesterId ?? '')
	}));
}

async function ambilKelas(sekolahId: number, kelasId: number) {
	return db.query.tableKelas.findFirst({
		columns: { id: true, nama: true, semesterId: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
}

async function ambilMapelKelas(kelasId: number) {
	return db.query.tableMataPelajaran.findMany({
		columns: { id: true, nama: true, urutan: true },
		where: eq(tableMataPelajaran.kelasId, kelasId),
		orderBy: asc(tableMataPelajaran.urutan)
	});
}

async function ambilMuridKelas(sekolahId: number, kelasId: number) {
	return db.query.tableMurid.findMany({
		columns: { id: true, nis: true, nisn: true, nama: true },
		where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.kelasId, kelasId)),
		orderBy: asc(tableMurid.nama)
	});
}

/** Template Excel: kolom NIS, NISN, Nama, lalu satu kolom per mata pelajaran. */
export async function buatTemplateNilai(
	sekolahId: number,
	kelasId: number,
	jenis: JenisImpor
): Promise<{ buffer: Buffer; namaFile: string }> {
	const kelas = await ambilKelas(sekolahId, kelasId);
	if (!kelas) throw new Error('Kelas tidak ditemukan.');
	const mapel = await ambilMapelKelas(kelasId);
	const murid = await ambilMuridKelas(sekolahId, kelasId);

	const header = ['NIS', 'NISN', 'Nama', ...mapel.map((m) => m.nama)];
	const baris = murid.map((m) => [m.nis, m.nisn, m.nama, ...mapel.map(() => '')]);

	const buffer = await writeAoaToBuffer([
		[`Impor Nilai ${jenis === 'sumatif' ? 'Sumatif' : 'Formatif'} — ${kelas.nama}`],
		[
			jenis === 'sumatif'
				? 'Isi kolom nilai akhir (0-100). Kosongkan bila belum dinilai.'
				: 'Isi kolom tuntas (Y/N).'
		],
		[],
		header,
		...baris
	]);

	return {
		buffer,
		namaFile: `Template Nilai ${jenis === 'sumatif' ? 'Sumatif' : 'Formatif'} ${kelas.nama}.xlsx`
	};
}

/**
 * Baca berkas Excel dan petakan ke data kelas.
 *
 * Aturan:
 * - Baris pertama yang berisi "NIS" dianggap baris header.
 * - Kolom mapel dicocokkan berdasarkan nama mapel di kelas (case-insensitive).
 * - Murid dicocokkan berdasarkan NIS, lalu NISN, lalu nama.
 */
export async function parseBerkasNilai(
	sekolahId: number,
	kelasId: number,
	jenis: JenisImpor,
	buffer: ArrayBuffer | Buffer
): Promise<HasilImpor> {
	const kelas = await ambilKelas(sekolahId, kelasId);
	const mapel = kelas ? await ambilMapelKelas(kelasId) : [];
	const murid = kelas ? await ambilMuridKelas(sekolahId, kelasId) : [];
	const pesanUmum: string[] = [];

	if (!kelas) {
		return {
			ok: false,
			jenis,
			kelasId,
			kelasNama: '-',
			mapel: [],
			baris: [],
			totalNilai: 0,
			barisValid: 0,
			barisBermasalah: 0,
			pesanUmum: ['Kelas tidak ditemukan.'],
			ringkasanMapel: []
		};
	}
	if (!mapel.length) {
		pesanUmum.push('Kelas ini belum punya mata pelajaran. Tambahkan mapel dulu.');
	}
	if (!murid.length) {
		pesanUmum.push('Kelas ini belum punya murid.');
	}

	let sheet: Array<Array<string | number>> = [];
	try {
		sheet = await readBufferToAoA(buffer);
	} catch (error) {
		console.warn('[impor-nilai] gagal membaca berkas:', error);
		pesanUmum.push('Berkas tidak bisa dibaca. Pastikan format .xlsx.');
	}

	const headerIndex = sheet.findIndex((row) => row.some((cell) => norm(cell) === 'nis'));
	if (headerIndex < 0) {
		pesanUmum.push('Baris header "NIS" tidak ditemukan. Gunakan template yang diunduh.');
		return {
			ok: false,
			jenis,
			kelasId,
			kelasNama: kelas.nama,
			mapel: mapel.map((m) => ({ id: m.id, nama: m.nama })),
			baris: [],
			totalNilai: 0,
			barisValid: 0,
			barisBermasalah: 0,
			pesanUmum,
			ringkasanMapel: []
		};
	}

	const header = sheet[headerIndex].map((cell) => String(cell ?? '').trim());
	const indexNis = header.findIndex((h) => norm(h) === 'nis');
	const indexNisn = header.findIndex((h) => norm(h) === 'nisn');
	const indexNama = header.findIndex((h) => norm(h) === 'nama');

	// Kolom mapel: cocokkan nama header dengan nama mapel kelas.
	const kolomMapel: Array<{ kolom: number; mapelId: number; nama: string }> = [];
	header.forEach((judul, index) => {
		if (index === indexNis || index === indexNisn || index === indexNama) return;
		const cocok = mapel.find((m) => norm(m.nama) === norm(judul));
		if (cocok) kolomMapel.push({ kolom: index, mapelId: cocok.id, nama: cocok.nama });
	});
	const kolomTakDikenali = header.filter(
		(_, index) =>
			index !== indexNis &&
			index !== indexNisn &&
			index !== indexNama &&
			!kolomMapel.some((k) => k.kolom === index)
	);
	for (const judul of kolomTakDikenali) {
		if (judul) pesanUmum.push(`Kolom "${judul}" tidak dikenal sebagai mata pelajaran kelas ini.`);
	}
	if (!kolomMapel.length && mapel.length) {
		pesanUmum.push('Tidak ada kolom mata pelajaran yang cocok dengan kelas ini.');
	}

	const muridByNis = new Map<string, { id: number; nama: string }>();
	const muridByNisn = new Map<string, { id: number; nama: string }>();
	const muridByNama = new Map<string, { id: number; nama: string }>();
	for (const m of murid) {
		muridByNis.set(norm(m.nis), { id: m.id, nama: m.nama });
		muridByNisn.set(norm(m.nisn), { id: m.id, nama: m.nama });
		muridByNama.set(norm(m.nama), { id: m.id, nama: m.nama });
	}

	const barisHasil: BarisImpor[] = [];
	for (let i = headerIndex + 1; i < sheet.length; i += 1) {
		const row = sheet[i];
		if (!row || row.every((cell) => String(cell ?? '').trim() === '')) continue;

		const nis = String(row[indexNis] ?? '').trim();
		const nisn = indexNisn >= 0 ? String(row[indexNisn] ?? '').trim() : '';
		const nama = indexNama >= 0 ? String(row[indexNama] ?? '').trim() : '';
		const masalah: string[] = [];

		if (!nis && !nisn && !nama) continue;

		let ditemukan = muridByNis.get(norm(nis));
		if (!ditemukan && nisn) ditemukan = muridByNisn.get(norm(nisn));
		if (!ditemukan && nama) ditemukan = muridByNama.get(norm(nama));
		if (!ditemukan) {
			masalah.push('Murid tidak ditemukan di kelas ini (periksa NIS/NISN).');
		}

		const nilai = new Map<number, number | boolean>();
		for (const kolom of kolomMapel) {
			const mentah = row[kolom.kolom];
			const parsed = jenis === 'sumatif' ? parseNilai(mentah) : parseTuntas(mentah);
			if (parsed == null) continue;
			if (typeof parsed === 'number' && Number.isNaN(parsed)) {
				masalah.push(`Nilai "${kolom.nama}" bukan angka.`);
				continue;
			}
			if (typeof parsed === 'number' && (parsed < 0 || parsed > 100)) {
				masalah.push(`Nilai "${kolom.nama}" di luar rentang 0-100.`);
				continue;
			}
			if (typeof parsed === 'boolean' && parsed === false) {
				// Column 'T' / 'FALSE' tetap disimpan sebagai belum tuntas.
			}
			nilai.set(kolom.mapelId, parsed);
		}

		barisHasil.push({
			baris: i + 1,
			muridId: ditemukan?.id ?? null,
			muridNama: (ditemukan?.nama ?? nama) || null,
			nis,
			nisn,
			nilai,
			masalah
		});
	}

	const totalNilai = barisHasil.reduce((total, baris) => total + baris.nilai.size, 0);
	const barisValid = barisHasil.filter((baris) => !baris.masalah.length).length;

	const ringkasanMapel = kolomMapel.map((kolom) => {
		let terisi = 0;
		let jumlah = 0;
		for (const baris of barisHasil) {
			const nilai = baris.nilai.get(kolom.mapelId);
			if (typeof nilai === 'number') {
				terisi += 1;
				jumlah += nilai;
			}
		}
		return {
			mapel: kolom.nama,
			terisi,
			rata: terisi > 0 ? Math.round((jumlah / terisi) * 100) / 100 : null
		};
	});

	return {
		ok: pesanUmum.length === 0 && barisValid > 0,
		jenis,
		kelasId,
		kelasNama: kelas.nama,
		mapel: mapel.map((m) => ({ id: m.id, nama: m.nama })),
		baris: barisHasil,
		totalNilai,
		barisValid,
		barisBermasalah: barisHasil.length - barisValid,
		pesanUmum,
		ringkasanMapel
	};
}

/**
 * Simpan hasil import ke tabel nilai.
 * Hanya baris tanpa masalah yang disimpan; sisanya dilewati.
 */
export async function simpanImporNilai(
	sekolahId: number,
	kelasId: number,
	jenis: JenisImpor,
	hasil: HasilImpor,
	aktor: { userId?: number | null; nama?: string | null }
): Promise<{ tersimpan: number; dilewati: number }> {
	const now = new Date().toISOString();
	let tersimpan = 0;
	let dilewati = 0;

	const tujuanPerMapel = new Map<number, number[]>();
	if (jenis === 'formatif') {
		const tujuan = await db.query.tableTujuanPembelajaran.findMany({
			columns: { id: true, mataPelajaranId: true },
			where: inArray(
				tableTujuanPembelajaran.mataPelajaranId,
				hasil.mapel.map((m) => m.id)
			)
		});
		for (const t of tujuan) {
			const list = tujuanPerMapel.get(t.mataPelajaranId) ?? [];
			list.push(t.id);
			tujuanPerMapel.set(t.mataPelajaranId, list);
		}
	}

	for (const baris of hasil.baris) {
		if (baris.masalah.length || !baris.muridId) {
			dilewati += baris.nilai.size;
			continue;
		}

		if (jenis === 'sumatif') {
			for (const [mapelId, nilai] of baris.nilai) {
				if (typeof nilai !== 'number') continue;
				const sebelumnya = await db.query.tableAsesmenSumatif.findFirst({
					columns: { id: true, nilaiAkhir: true },
					where: and(
						eq(tableAsesmenSumatif.muridId, baris.muridId),
						eq(tableAsesmenSumatif.mataPelajaranId, mapelId)
					)
				});
				await db
					.insert(tableAsesmenSumatif)
					.values({
						muridId: baris.muridId,
						mataPelajaranId: mapelId,
						nilaiAkhir: nilai,
						updatedAt: now
					})
					.onConflictDoUpdate({
						target: [tableAsesmenSumatif.muridId, tableAsesmenSumatif.mataPelajaranId],
						set: { nilaiAkhir: nilai, updatedAt: now }
					});
				tersimpan += 1;
				if (sebelumnya && sebelumnya.nilaiAkhir !== nilai) {
					await catatAudit({
						sekolahId,
						userId: aktor.userId ?? null,
						aktor: aktor.nama ?? null,
						aksi: 'import_nilai',
						entitas: 'asesmen_sumatif',
						entitasId: mapelId,
						ringkasan: `Nilai akhir ${hasil.kelasNama} - ${
							hasil.mapel.find((m) => m.id === mapelId)?.nama ?? 'mapel'
						} (${baris.muridNama || baris.nis})`,
						detail: {
							muridId: baris.muridId,
							nilaiLama: sebelumnya?.nilaiAkhir ?? null,
							nilaiBaru: nilai,
							sumber: 'excel'
						}
					});
				}
			}
		} else {
			for (const [mapelId, nilai] of baris.nilai) {
				if (typeof nilai !== 'boolean') continue;
				const tujuanIds = tujuanPerMapel.get(mapelId) ?? [];
				for (const tujuanId of tujuanIds) {
					await db
						.insert(tableAsesmenFormatif)
						.values({
							muridId: baris.muridId,
							mataPelajaranId: mapelId,
							tujuanPembelajaranId: tujuanId,
							tuntas: nilai,
							updatedAt: now
						})
						.onConflictDoUpdate({
							target: [tableAsesmenFormatif.muridId, tableAsesmenFormatif.tujuanPembelajaranId],
							set: { tuntas: nilai, updatedAt: now }
						});
					tersimpan += 1;
				}
			}
		}
	}

	await catatAudit({
		sekolahId,
		userId: aktor.userId ?? null,
		aktor: aktor.nama ?? null,
		aksi: 'import_nilai',
		entitas: jenis,
		entitasId: kelasId,
		ringkasan: `Impor ${jenis === 'sumatif' ? 'nilai sumatif' : 'nilai formatif'} ${hasil.kelasNama}: ${tersimpan} nilai tersimpan, ${dilewati} dilewati`,
		detail: { tersimpan, dilewati, totalNilai: hasil.totalNilai }
	});

	return { tersimpan, dilewati };
}
