import db from '$lib/server/db';
import { ensureSchema } from './ensure-helper';

const KOLOM_SEKOLAH =
	'"sekolah_id" integer NOT NULL, "created_at" text NOT NULL, "updated_at" text';
const FK_SEKOLAH = `CONSTRAINT "{N}_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`;

/**
 * Tabel-modul tambahan Rapor Merdeka-parity: PKL/Prakerin, poin siswa, P5BK,
 * dan presensi per kelas. Semua dibuat lewat ensureSchema sehingga idempoten.
 */
export async function ensureEkspansiModulSchema() {
	await ensureSchema('pkl_perusahaan', [
		`CREATE TABLE IF NOT EXISTS "pkl_perusahaan" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"nama" text NOT NULL,
			"alamat" text, "bidang_usaha" text, "pembimbing" text, "telepon" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'pkl_perusahaan')}
		)`,
		`CREATE INDEX IF NOT EXISTS "pkl_perusahaan_sekolah_idx" ON "pkl_perusahaan" ("sekolah_id")`
	]);

	await ensureSchema('pkl_kelompok', [
		`CREATE TABLE IF NOT EXISTS "pkl_kelompok" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"kelas_id" integer NOT NULL,
			"perusahaan_id" integer, "pembimbing_pegawai_id" integer,
			"nama" text, "sk_penugasan" text, "tanggal_mulai" text, "tanggal_selesai" text,
			"lokasi" text, "catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'pkl_kelompok')},
			CONSTRAINT "pkl_kelompok_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS "pkl_kelompok_sekolah_idx" ON "pkl_kelompok" ("sekolah_id")`,
		`CREATE INDEX IF NOT EXISTS "pkl_kelompok_kelas_idx" ON "pkl_kelompok" ("kelas_id")`
	]);

	await ensureSchema('pkl_murid', [
		`CREATE TABLE IF NOT EXISTS "pkl_murid" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"kelompok_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			"catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'pkl_murid')},
			CONSTRAINT "pkl_murid_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "pkl_kelompok" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "pkl_murid_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "pkl_murid_kelompok_murid_unique" ON "pkl_murid" ("kelompok_id","murid_id")`,
		`CREATE INDEX IF NOT EXISTS "pkl_murid_murid_idx" ON "pkl_murid" ("murid_id")`
	]);

	await ensureSchema('pkl_tujuan', [
		`CREATE TABLE IF NOT EXISTS "pkl_tujuan" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"urutan" integer DEFAULT 0,
			"deskripsi" text NOT NULL,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'pkl_tujuan')}
		)`,
		`CREATE INDEX IF NOT EXISTS "pkl_tujuan_sekolah_idx" ON "pkl_tujuan" ("sekolah_id")`
	]);

	await ensureSchema('pkl_nilai', [
		`CREATE TABLE IF NOT EXISTS "pkl_nilai" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"tujuan_id" integer NOT NULL,
			"nilais" text NOT NULL, "predikat" text, "catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'pkl_nilai')},
			CONSTRAINT "pkl_nilai_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "pkl_nilai_tujuan_id_tujuan_id_fk" FOREIGN KEY ("tujuan_id") REFERENCES "pkl_tujuan" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "pkl_nilai_murid_tujuan_unique" ON "pkl_nilai" ("murid_id","tujuan_id")`,
		`CREATE INDEX IF NOT EXISTS "pkl_nilai_murid_idx" ON "pkl_nilai" ("murid_id")`
	]);

	await ensureSchema('poin_pelanggaran', [
		`CREATE TABLE IF NOT EXISTS "poin_pelanggaran" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"nama" text NOT NULL,
			"poin" integer DEFAULT 0 NOT NULL,
			"kategori" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'poin_pelanggaran')}
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "poin_pelanggaran_sekolah_nama_unique" ON "poin_pelanggaran" ("sekolah_id","nama")`
	]);

	await ensureSchema('poin_siswa', [
		`CREATE TABLE IF NOT EXISTS "poin_siswa" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"pelanggaran_id" integer NOT NULL,
			"tanggal" text NOT NULL,
			"pelapor_pegawai_id" integer,
			"catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'poin_siswa')},
			CONSTRAINT "poin_siswa_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "poin_siswa_pelanggaran_id_poin_pelanggaran_id_fk" FOREIGN KEY ("pelanggaran_id") REFERENCES "poin_pelanggaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "poin_siswa_pelapor_pegawai_id_pegawai_id_fk" FOREIGN KEY ("pelapor_pegawai_id") REFERENCES "pegawai" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
		)`,
		`CREATE INDEX IF NOT EXISTS "poin_siswa_murid_idx" ON "poin_siswa" ("murid_id")`,
		`CREATE INDEX IF NOT EXISTS "poin_siswa_sekolah_idx" ON "poin_siswa" ("sekolah_id")`
	]);

	await ensureSchema('p5_projek', [
		`CREATE TABLE IF NOT EXISTS "p5_projek" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"kelas_id" integer NOT NULL,
			"tema" text NOT NULL,
			"judul" text NOT NULL,
			"pembina_pegawai_id" integer,
			"tahun_tahun_ajaran_id" integer,
			"catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'p5_projek')},
			CONSTRAINT "p5_projek_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "p5_projek_pembina_pegawai_id_pegawai_id_fk" FOREIGN KEY ("pembina_pegawai_id") REFERENCES "pegawai" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
			CONSTRAINT "p5_projek_tahun_tahun_ajaran_id_tahun_ajaran_id_fk" FOREIGN KEY ("tahun_tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS "p5_projek_sekolah_idx" ON "p5_projek" ("sekolah_id")`
	]);

	await ensureSchema('p5_anggota', [
		`CREATE TABLE IF NOT EXISTS "p5_anggota" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"projek_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'p5_anggota')},
			CONSTRAINT "p5_anggota_projek_id_p5_projek_id_fk" FOREIGN KEY ("projek_id") REFERENCES "p5_projek" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "p5_anggota_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "p5_anggota_projek_murid_unique" ON "p5_anggota" ("projek_id","murid_id")`,
		`CREATE INDEX IF NOT EXISTS "p5_anggota_murid_idx" ON "p5_anggota" ("murid_id")`
	]);

	await ensureSchema('p5_nilai', [
		`CREATE TABLE IF NOT EXISTS "p5_nilai" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"projek_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			"dimensi" text NOT NULL,
			"rating" text NOT NULL,
			"catatan" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'p5_nilai')},
			CONSTRAINT "p5_nilai_projek_id_p5_projek_id_fk" FOREIGN KEY ("projek_id") REFERENCES "p5_projek" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "p5_nilai_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "p5_nilai_projek_murid_dimensi_unique" ON "p5_nilai" ("projek_id","murid_id","dimensi")`,
		`CREATE INDEX IF NOT EXISTS "p5_nilai_murid_idx" ON "p5_nilai" ("murid_id")`
	]);

	await ensureSchema('kelas_presensi', [
		`CREATE TABLE IF NOT EXISTS "kelas_presensi" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"kelas_id" integer NOT NULL,
			"hari_aktif" text DEFAULT '1,1,1,1,1,1,0' NOT NULL,
			"jam_masuk" text, "jam_pulang" text,
			${KOLOM_SEKOLAH},
			${FK_SEKOLAH.replace('{N}', 'kelas_presensi')},
			CONSTRAINT "kelas_presensi_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "kelas_presensi_kelas_id_unique" ON "kelas_presensi" ("kelas_id")`
	]);

	// Pastikan indeks sekolah ada di tabel-tabel yang merujuk sekolah biar rekap cepat.
	await db.$client.execute(
		`CREATE INDEX IF NOT EXISTS "pkl_kelompok_kelas_idx" ON "pkl_kelompok" ("kelas_id")`
	);
}
