import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

// fs/path imports were previously used to derive permissions from source, but we
// now use a canonical list embedded below to avoid brittle parsing.

// Try to derive permissions list from source file `src/routes/pengguna/permissions.ts`.
// If parsing fails, fall back to a conservative static list.
// Use a canonical, explicit list of permissions derived from `src/routes/pengguna/permissions.ts`.
// Parsing the TS source can be brittle across formatting; keep a fixed authoritative list here
// so grant-admin-perms is deterministic and idempotent.
const REQUIRED_PERMISSIONS = [
	'user_list',
	'user_detail',
	'user_add',
	'user_delete',
	'user_suspend',
	'user_set_permissions',
	'dashboard_manage',
	'app_check_update',
	'server_stop',
	'kelas_pindah',
	'informasi_umum_sekolah',
	'informasi_umum_akademik',
	'informasi_umum_kelas',
	'informasi_umum_murid',
	'mata_pelajaran_intrakurikuler',
	'mata_pelajaran_kokurikuler',
	'mata_pelajaran_ekstrakurikuler',
	'input_nilai_asesmen_formatif',
	'input_nilai_asesmen_sumatif',
	'input_nilai_asesmen_kokurikuler',
	'input_nilai_nilai_ekstrakurikuler',
	'administrasi_absen',
	'administrasi_rpm',
	'administrasi_jurnal_mengajar',
	'administrasi_catatan_wali_kelas',
	'administrasi_rekap_nilai',
	'administrasi_keputusan',
	'administrasi_buku_tamu',
	'administrasi_presensi_guru',
	'administrasi_sppd',
	'administrasi_dinas_luar',
	'administrasi_sinkronisasi',
	'cetak_dokumen'
];

const DEFAULT_DB_URL = 'file:./data/database.sqlite3';
const dbUrl = process.env.DB_URL || DEFAULT_DB_URL;

// Izin fitur yang sudah dihapus dari produk — jangan dipertahankan saat merge.
const REMOVED_LEGACY_PERMISSIONS = ['mata_pelajaran_keasramaan', 'input_nilai_asesmen_keasramaan'];

const client = createClient({ url: dbUrl });

/**
 * Bandingkan daftar kanonik di atas dengan `src/routes/pengguna/permissions.ts`.
 * Hanya peringatan: menjalankan skrip di mesin user tanpa source tetap aman.
 */
function warnIfDrifted() {
	try {
		const sourcePath = path.resolve(process.cwd(), 'src/routes/pengguna/permissions.ts');
		if (!fs.existsSync(sourcePath)) return;
		const source = fs.readFileSync(sourcePath, 'utf8');
		const start = source.indexOf('groupedUserPermissions = {');
		const end = source.indexOf('} as const;', start);
		if (start < 0 || end < 0) return;

		const canonical = [];
		let group = null;
		for (const line of source.slice(start, end).split('\n')) {
			const groupMatch = line.match(/^\t([a-z_]+): \{/);
			if (groupMatch) {
				group = groupMatch[1];
				continue;
			}
			if (!group) continue;
			for (const valueMatch of line.matchAll(/\[(?:\[)?'([a-z_]+)',/g)) {
				canonical.push(`${group}_${valueMatch[1]}`);
			}
		}
		if (!canonical.length) return;

		const missing = canonical.filter((p) => !REQUIRED_PERMISSIONS.includes(p));
		const extra = REQUIRED_PERMISSIONS.filter((p) => !canonical.includes(p));
		if (!missing.length && !extra.length) return;

		console.warn('[grant-admin-perms] Daftar izin TIDAK sinkron dengan permissions.ts');
		if (missing.length) console.warn('[grant-admin-perms] Kurang:', missing.join(', '));
		if (extra.length) console.warn('[grant-admin-perms] Berlebih:', extra.join(', '));
	} catch (err) {
		console.warn('[grant-admin-perms] Gagal memeriksa izin kanonik:', err?.message || err);
	}
}

async function mergePermissions(existingJson) {
	let existing = [];
	if (existingJson) {
		try {
			existing = JSON.parse(existingJson);
		} catch {
			existing = [];
		}
	}
	const kept = existing.filter((p) => !REMOVED_LEGACY_PERMISSIONS.includes(p));
	const merged = Array.from(new Set([...kept, ...REQUIRED_PERMISSIONS]));
	return merged;
}

async function main() {
	console.info('[grant-admin-perms] Target DB:', dbUrl);
	warnIfDrifted();

	// Find admin and kepala_sekolah users (both have full administrative access;
	// kepala_sekolah is admin-equivalent but scoped to one sekolah).
	const rows = await client.execute({
		sql: "SELECT id, username, username_normalized, permissions FROM auth_user WHERE type IN ('admin', 'kepala_sekolah') OR username_normalized = 'admin'"
	});

	const results = rows.rows || [];
	if (!results.length) {
		console.info('[grant-admin-perms] No admin user found. Nothing to do.');
		await client.close();
		return;
	}

	for (const r of results) {
		const id = r.id;
		const username = r.username || r.username_normalized || String(id);
		const existingJson = r.permissions || '[]';
		const merged = await mergePermissions(existingJson);
		const mergedJson = JSON.stringify(merged);
		await client.execute({
			sql: 'UPDATE auth_user SET permissions = ? WHERE id = ?',
			args: [mergedJson, id]
		});
		console.info(
			`[grant-admin-perms] Updated admin/kepala_sekolah: ${username} (id=${id}) -> ${merged.length} permissions`
		);
	}

	await client.close();
	console.info('[grant-admin-perms] Done.');
}

main().catch((err) => {
	console.error('[grant-admin-perms] Failed', err);
	process.exitCode = 1;
});
