import db from '$lib/server/db';

async function columnExists(table: string, column: string): Promise<boolean> {
	try {
		const result = await db.$client.execute(`PRAGMA table_info("${table}")`);
		return result.rows.some((row) => String((row as { name?: unknown }).name) === column);
	} catch {
		return false;
	}
}

/**
 * NIK guru dipakai sebagai identitas login. Database lama belum punya kolom
 * ini; isi lewat form pengguna atau sinkronisasi Dapodik setelah migrasi.
 */
export async function ensurePegawaiNikSchema() {
	if (!(await columnExists('pegawai', 'nik'))) {
		await db.$client.execute(`ALTER TABLE "pegawai" ADD COLUMN "nik" text`);
	}
}
