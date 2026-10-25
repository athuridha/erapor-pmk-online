import db from '$lib/server/db';
import { ensureSchema } from './ensure-helper';

async function columnExists(table: string, column: string): Promise<boolean> {
	try {
		const result = await db.$client.execute(`PRAGMA table_info("${table}")`);
		return result.rows.some((row) => String((row as { name?: unknown }).name) === column);
	} catch {
		return false;
	}
}

export const TEKNIK_PENILAIAN_DEFAULT = [
	{
		nama: 'Tes Tulis',
		singkatan: 'TT',
		keterangan: 'Ujian tertulis, kuis, soal pilihan ganda / uraian',
		urutan: 1
	},
	{
		nama: 'Tes Lisan',
		singkatan: 'TL',
		keterangan: 'Tanya jawab lisan, wawancara pemahaman konsep',
		urutan: 2
	},
	{
		nama: 'Penugasan',
		singkatan: 'TG',
		keterangan: 'Pekerjaan rumah, tugas mandiri / kelompok',
		urutan: 3
	},
	{
		nama: 'Kinerja / Praktik',
		singkatan: 'KJ',
		keterangan: 'Unjuk kerja, demonstrasi, simulasi, laboratorium',
		urutan: 4
	},
	{
		nama: 'Proyek',
		singkatan: 'PR',
		keterangan: 'Investigasi / pembuatan karya terencana bertahap',
		urutan: 5
	},
	{
		nama: 'Portofolio',
		singkatan: 'PF',
		keterangan: 'Kumpulan dokumen karya / bukti belajar murid',
		urutan: 6
	},
	{
		nama: 'Observasi',
		singkatan: 'OB',
		keterangan: 'Pengamatan sikap dan proses belajar selama KBM',
		urutan: 7
	}
] as const;

export async function ensureTeknikPenilaianSchema() {
	await ensureSchema('teknik_penilaian', [
		`CREATE TABLE IF NOT EXISTS "teknik_penilaian" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"nama" text NOT NULL,
			"singkatan" text NOT NULL,
			"keterangan" text,
			"urutan" integer DEFAULT 0,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "teknik_penilaian_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "teknik_penilaian_sekolah_nama_idx" ON "teknik_penilaian" ("sekolah_id", "nama")`
	]);

	if (!(await columnExists('tujuan_pembelajaran', 'teknik_penilaian_id'))) {
		await db.$client.execute(
			`ALTER TABLE "tujuan_pembelajaran" ADD COLUMN "teknik_penilaian_id" integer REFERENCES "teknik_penilaian"("id") ON DELETE SET NULL`
		);
	}
}

export async function seedDefaultTeknikPenilaian(sekolahId: number) {
	for (const item of TEKNIK_PENILAIAN_DEFAULT) {
		const existing = await db.$client.execute({
			sql: `SELECT id FROM teknik_penilaian WHERE sekolah_id = ? AND (nama = ? OR singkatan = ?)`,
			args: [sekolahId, item.nama, item.singkatan]
		});
		if (existing.rows.length === 0) {
			await db.$client.execute({
				sql: `INSERT INTO teknik_penilaian (sekolah_id, nama, singkatan, keterangan, urutan, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
				args: [
					sekolahId,
					item.nama,
					item.singkatan,
					item.keterangan,
					item.urutan,
					new Date().toISOString()
				]
			});
		}
	}
}
