import { ensureSchema } from './ensure-helper';

/**
 * Kunci nilai: operator/admin mengunci nilai sumatif per mata pelajaran
 * supaya guru tidak bisa mengubahnya lagi setelah rapor dibagikan.
 */
export async function ensureKunciNilaiSchema() {
	await ensureSchema('kunci_nilai', [
		`CREATE TABLE IF NOT EXISTS "kunci_nilai" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"dikunci_oleh" integer,
			"dikunci_pada" text,
			"alasan" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "kunci_nilai_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "kunci_nilai_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "kunci_nilai_dikunci_oleh_auth_user_id_fk" FOREIGN KEY ("dikunci_oleh") REFERENCES "auth_user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "kunci_nilai_mata_pelajaran_id_unique" ON "kunci_nilai" ("mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "kunci_nilai_sekolah_id_idx" ON "kunci_nilai" ("sekolah_id")`
	]);
}
