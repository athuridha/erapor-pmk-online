import { eq } from 'drizzle-orm';
import {
	defaultPermissionsByType,
	removedLegacyPermissionKeys
} from '../../../routes/pengguna/permissions';
import db from './index.js';
import { tableAppMeta, tableAuthUser } from './schema';

const MIGRATION_KEY = 'permission_model_version';
const MIGRATION_VALUE = 'menu-based-v6';

/**
 * Pembersihan izin lama. Sejak **v6 migrasi tidak lagi menimpa izin per akun**:
 * admin bebas mengatur izin tiap pengguna, jadi template role hanya diterapkan
 * saat akun dibuat atau ketika admin menekan "Terapkan template" di /pengguna.
 *
 * Yang dikerjakan di sini:
 *   - buang key izin yang sudah dihapus dari produk (`removedLegacyPermissionKeys`)
 *   - isi default role hanya untuk akun yang belum punya izin sama sekali
 *
 * Riwayat: v1-v5 memindahkan model lama (sekolah_manage/rapor_manage/kelas_manage)
 * ke model berbasis menu; v3-v5 sempat menimpa izin wali_kelas/wali_asuh dengan
 * set default. Perilaku menimpa itu dihentikan di v6 (merusak kustomisasi admin).
 *
 * Idempotent: ditandai di tabel `app_meta` sehingga hanya berjalan sekali per versi.
 */
export async function ensurePermissionMigration() {
	try {
		const marker = await db.query.tableAppMeta.findFirst({
			where: eq(tableAppMeta.key, MIGRATION_KEY)
		});
		if (marker?.value === MIGRATION_VALUE) return;

		const users = await db.query.tableAuthUser.findMany({
			columns: { id: true, type: true, permissions: true }
		});

		let changed = 0;
		const timestamp = new Date().toISOString();
		for (const u of users) {
			const existing = Array.isArray(u.permissions) ? u.permissions : [];
			const validExisting = existing.filter((p) => !removedLegacyPermissionKeys.has(p));

			// Akun yang sudah punya izin dipertahankan apa adanya — hanya key usang
			// yang dibuang. Default role hanya dipakai untuk akun non-admin yang
			// masih kosong (admin selalu punya akses penuh tanpa daftar izin).
			let merged = validExisting;
			if (u.type !== 'admin' && validExisting.length === 0) {
				merged = Array.from(new Set(defaultPermissionsByType[u.type] ?? []));
			}

			const sameSet =
				merged.length === existing.length && merged.every((p) => existing.includes(p));
			if (!sameSet) {
				await db
					.update(tableAuthUser)
					.set({ permissions: merged, updatedAt: timestamp })
					.where(eq(tableAuthUser.id, u.id));
				changed += 1;
			}
		}

		await db
			.insert(tableAppMeta)
			.values({
				key: MIGRATION_KEY,
				value: MIGRATION_VALUE,
				createdAt: timestamp,
				updatedAt: timestamp
			})
			.onConflictDoUpdate({ target: tableAppMeta.key, set: { value: MIGRATION_VALUE } });

		if (changed > 0) {
			console.info(`[permission-migration] Updated permissions for ${changed} user(s)`);
		}
	} catch (err) {
		console.warn('[permission-migration] Migration failed (skipped):', err);
	}
}
