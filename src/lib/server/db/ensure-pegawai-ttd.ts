import db from '$lib/server/db';
import { migratePersonSignaturesToDb } from '$lib/server/ttd';

const COLUMN = 'tanda_tangan';

async function columnExists(): Promise<boolean> {
	try {
		const result = await db.$client.execute('PRAGMA table_info("pegawai")');
		return result.rows.some((row) => String((row as { name?: unknown }).name) === COLUMN);
	} catch {
		return false;
	}
}

/**
 * Kolom tanda tangan pegawai (kepala sekolah, wali kelas, guru) pada `pegawai`.
 *
 * Awalnya tanda tangan hanya berkas PNG di folder data, sehingga tidak ikut saat
 * database di-backup atau dipindah ke komputer lain. Sekarang isinya disimpan
 * sebagai data URL di database supaya selalu terbawa; berkas lama dipindahkan
 * otomatis satu kali.
 */
export async function ensurePegawaiTtdSchema() {
	if (!(await columnExists())) {
		await db.$client.execute(`ALTER TABLE "pegawai" ADD COLUMN "${COLUMN}" text`);
	}

	await migratePersonSignaturesToDb();
}
