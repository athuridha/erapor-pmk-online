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

/**
 * Arsip murid: status kelulusan + berkas KK, akta, ijazah terakhir, dan
 * ijazah yang diterbitkan sekolah untuk murid lulus.
 */
export async function ensureMuridArsipSchema() {
	if (!(await columnExists('murid', 'status'))) {
		await db.$client.execute(
			`ALTER TABLE "murid" ADD COLUMN "status" text NOT NULL DEFAULT 'aktif'`
		);
	}
	if (!(await columnExists('murid', 'tanggal_lulus'))) {
		await db.$client.execute(`ALTER TABLE "murid" ADD COLUMN "tanggal_lulus" text`);
	}
	if (!(await columnExists('murid', 'tanggal_keluar'))) {
		await db.$client.execute(`ALTER TABLE "murid" ADD COLUMN "tanggal_keluar" text`);
	}
	if (!(await columnExists('murid', 'alasan_keluar'))) {
		await db.$client.execute(`ALTER TABLE "murid" ADD COLUMN "alasan_keluar" text`);
	}

	await ensureSchema('murid_arsip', [
		`CREATE TABLE IF NOT EXISTS "murid_lampiran" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"jenis" text NOT NULL,
			"nama_file" text NOT NULL,
			"file_path" text NOT NULL,
			"mime_type" text NOT NULL,
			"ukuran" integer DEFAULT 0 NOT NULL,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "murid_lampiran_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "murid_lampiran_murid_jenis_idx" ON "murid_lampiran" ("murid_id", "jenis")`,
		`CREATE INDEX IF NOT EXISTS "murid_lampiran_murid_idx" ON "murid_lampiran" ("murid_id")`
	]);
}
