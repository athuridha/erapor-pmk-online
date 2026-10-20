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
 * Ekstrakurikuler bisa berlaku untuk semua kelas, bukan hanya satu kelas.
 * Kolom `semua_kelas` ditambahkan ke database lama tanpa rebuild tabel.
 */
export async function ensureEkstrakurikulerSchema() {
	await ensureSchema('ekstrakurikuler', [
		`CREATE TABLE IF NOT EXISTS "ekstrakurikuler" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"nama" text NOT NULL,
			"kelas_id" integer NOT NULL,
			"semua_kelas" integer DEFAULT 0 NOT NULL,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "ekstrakurikuler_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "ekstrakurikuler_kelas_id_nama_unique" ON "ekstrakurikuler" ("kelas_id","nama")`
	]);

	if (!(await columnExists('ekstrakurikuler', 'semua_kelas'))) {
		await db.$client.execute(
			`ALTER TABLE "ekstrakurikuler" ADD COLUMN "semua_kelas" integer NOT NULL DEFAULT 0`
		);
	}
}
