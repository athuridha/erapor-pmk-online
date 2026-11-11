import { eq } from 'drizzle-orm';
import {
	defaultPermissionsByType,
	removedLegacyPermissionKeys
} from '../../../routes/pengguna/permissions';
import db from './index.js';
import { tableAppMeta, tableAuthUser } from './schema';

const MIGRATION_KEY = 'permission_model_version';
const MIGRATION_VALUE = 'menu-based-v7';

const ADMIN_ONLY_RESTRICTED_KEYS = new Set([
	'informasi_umum_kelas',
	'informasi_umum_sekolah',
	'informasi_umum_akademik',
	'overview_semua_kelas'
]);

const APPEND_PERMISSION_KEY = 'permission_append_presensi_guru';
const APPEND_PERMISSION_VALUE = 'v1';

/**
 * Satu-kali tambahkan izin `administrasi_presensi_guru` ke akun guru lama.
 *
 * Template role `user`/`wali_kelas` kini memuat izin tersebut (halaman
 * /presensi-guru memakainya sebagai sumber kebenaran). Akun yang sudah ada
 * tidak pernah ditimpa oleh migrasi model izin, jadi tanpa langkah ini guru
 * lama tidak melihat menu Presensi Guru — padahal fiturnya memang untuk
 * mereka. Hanya menambah satu key; izin lain milik admin tidak disentuh.
 */
async function appendPresensiGuruPermission() {
	const marker = await db.query.tableAppMeta.findFirst({
		where: eq(tableAppMeta.key, APPEND_PERMISSION_KEY)
	});
	if (marker?.value === APPEND_PERMISSION_VALUE) return;

	const targetTypes = new Set(['user', 'wali_kelas', 'wali_asuh']);
	const users = await db.query.tableAuthUser.findMany({
		columns: { id: true, type: true, permissions: true }
	});
	const timestamp = new Date().toISOString();
	let changed = 0;

	for (const u of users) {
		if (!targetTypes.has(u.type)) continue;
		const permissions = Array.isArray(u.permissions) ? u.permissions : [];
		// Akun tanpa izin sama sekali akan memakai template role saat
		// migrasi utama berjalan — jangan campur dua mekanisme.
		if (permissions.length === 0) continue;
		if (permissions.includes('administrasi_presensi_guru')) continue;
		await db
			.update(tableAuthUser)
			.set({
				permissions: [...permissions, 'administrasi_presensi_guru'],
				updatedAt: timestamp
			})
			.where(eq(tableAuthUser.id, u.id));
		changed += 1;
	}

	await db
		.insert(tableAppMeta)
		.values({
			key: APPEND_PERMISSION_KEY,
			value: APPEND_PERMISSION_VALUE,
			createdAt: timestamp,
			updatedAt: timestamp
		})
		.onConflictDoUpdate({
			target: tableAppMeta.key,
			set: { value: APPEND_PERMISSION_VALUE, updatedAt: timestamp }
		});

	if (changed > 0) {
		console.info(`[permission-migration] Granted presensi-guru permission to ${changed} user(s)`);
	}
}

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
		await appendPresensiGuruPermission();
	} catch (err) {
		console.warn('[permission-migration] Append presensi-guru permission failed (skipped):', err);
	}

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
			let validExisting = existing.filter((p) => !removedLegacyPermissionKeys.has(p));
			if (u.type !== 'admin' && u.type !== 'kepala_sekolah') {
				validExisting = validExisting.filter((p) => !ADMIN_ONLY_RESTRICTED_KEYS.has(p));
			}

			// Akun yang sudah punya izin dipertahankan apa adanya — hanya key usang
			// yang dibuang. Default role hanya dipakai untuk akun non-admin yang
			// masih kosong (admin selalu punya akses penuh tanpa daftar izin).
			let merged = validExisting;
			if (u.type !== 'admin' && u.type !== 'kepala_sekolah' && validExisting.length === 0) {
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
