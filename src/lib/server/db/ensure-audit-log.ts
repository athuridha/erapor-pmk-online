import { ensureSchema } from './ensure-helper';

/**
 * Jejak audit perubahan data (nilai, impor massal, dan perubahan penting
 * lainnya). Tabel dibuat otomatis bila belum ada.
 */
export async function ensureAuditLogSchema() {
	await ensureSchema('audit_log', [
		`CREATE TABLE IF NOT EXISTS "audit_log" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"user_id" integer,
			"aktor" text,
			"aksi" text NOT NULL,
			"entitas" text NOT NULL,
			"entitas_id" integer,
			"ringkasan" text,
			"detail" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "audit_log_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "audit_log_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
		)`,
		`CREATE INDEX IF NOT EXISTS "audit_log_sekolah_idx" ON "audit_log" ("sekolah_id")`,
		`CREATE INDEX IF NOT EXISTS "audit_log_aksi_idx" ON "audit_log" ("aksi")`,
		`CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "audit_log" ("created_at")`
	]);
}
