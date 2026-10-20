import { ensureSchema } from './ensure-helper';

/**
 * Akun portal orang tua disimpan di database lokal e-Rapor. Publikasi ke D1
 * hanya menyalin hash password, sehingga reset dari e-Rapor bisa menimpa
 * password portal tanpa menghapus akun.
 */
export async function ensurePortalOrangtuaSchema() {
	await ensureSchema('portal_orangtua', [
		`CREATE TABLE IF NOT EXISTS "portal_orangtua" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"telepon" text NOT NULL,
			"nama" text NOT NULL,
			"password_hash" text NOT NULL,
			"password_salt" text NOT NULL,
			"must_change_password" integer DEFAULT 1 NOT NULL,
			"is_active" integer DEFAULT 1 NOT NULL,
			"force_password_sync" integer DEFAULT 1 NOT NULL,
			"last_published_at" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "portal_orangtua_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "portal_orangtua_sekolah_telepon_idx" ON "portal_orangtua" ("sekolah_id", "telepon")`,
		`CREATE TABLE IF NOT EXISTS "portal_orangtua_murid" (
			"orangtua_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			"hubungan" text DEFAULT 'wali' NOT NULL,
			PRIMARY KEY ("orangtua_id", "murid_id"),
			CONSTRAINT "portal_orangtua_murid_orangtua_id_portal_orangtua_id_fk" FOREIGN KEY ("orangtua_id") REFERENCES "portal_orangtua" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "portal_orangtua_murid_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS "portal_orangtua_murid_murid_idx" ON "portal_orangtua_murid" ("murid_id")`,
		`CREATE INDEX IF NOT EXISTS "portal_orangtua_murid_orangtua_idx" ON "portal_orangtua_murid" ("orangtua_id")`
	]);
}
