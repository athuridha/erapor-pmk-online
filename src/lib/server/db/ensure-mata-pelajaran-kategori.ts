import db from '$lib/server/db';
import { tableAppMeta, tableMataPelajaran } from '$lib/server/db/schema';
import { ensureSchema } from './ensure-helper';
import { eq, inArray } from 'drizzle-orm';

const SEED_FLAG_KEY = 'mapel_kategori_seed_done';

async function columnExists(table: string, column: string): Promise<boolean> {
	try {
		const result = await db.$client.execute(`PRAGMA table_info("${table}")`);
		return result.rows.some((row) => String((row as { name?: unknown }).name) === column);
	} catch {
		return false;
	}
}

/**
 * Kolom `kategori` memetakan mapel ke Intrakurikuler / Kokurikuler.
 * Baris baru default 'intrakurikuler'; seed sekali memindahkan mapel uji
 * (Uji Fisika / Uji Matematika — bukan mapel kurikulum) ke 'kokurikuler'.
 */
export async function ensureMataPelajaranKategoriSchema() {
	// Nama key terdaftar di ensureSchema agar konsisten dengan helper lain;
	// tabel mata_pelajaran sendiri dibuat oleh ensureCoreSchema.
	await ensureSchema('mata_pelajaran_kategori', []);

	if (!(await columnExists('mata_pelajaran', 'kategori'))) {
		await db.$client.execute(
			`ALTER TABLE "mata_pelajaran" ADD COLUMN "kategori" text NOT NULL DEFAULT 'intrakurikuler'`
		);
	}

	// Seed sekali: mapel uji -> kokurikuler. Flag di app_meta agar tidak menimpa
	// kategori yang sudah diubah manual oleh pengguna.
	const flag = await db.query.tableAppMeta.findFirst({
		columns: { key: true },
		where: eq(tableAppMeta.key, SEED_FLAG_KEY)
	});
	if (!flag) {
		await db
			.update(tableMataPelajaran)
			.set({ kategori: 'kokurikuler' })
			.where(inArray(tableMataPelajaran.nama, ['Uji Fisika', 'Uji Matematika']));

		const now = new Date().toISOString();
		await db
			.insert(tableAppMeta)
			.values({ key: SEED_FLAG_KEY, value: '1', createdAt: now })
			.onConflictDoNothing();
		const hasil = await db.query.tableMataPelajaran.findMany({
			columns: { id: true },
			where: eq(tableMataPelajaran.kategori, 'kokurikuler')
		});
		console.info(
			`[ensure-mata-pelajaran-kategori] seed selesai, ${hasil.length} baris berkategori kokurikuler`
		);
	}
}
