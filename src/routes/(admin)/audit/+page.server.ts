import { loadAuditLog } from '$lib/admin/audit.server';
import { error } from '@sveltejs/kit';

export const load = async ({ locals, url, depends }) => {
	depends('app:audit-log');
	const meta: PageMeta = { title: 'Jejak Audit' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Jejak audit hanya bisa dilihat admin dan kepala sekolah.');
	}

	const aksi = url.searchParams.get('aksi')?.trim() || null;
	const daftar = await loadAuditLog(sekolahId, { limit: 200, aksi });

	return {
		meta,
		daftar,
		filter: { aksi }
	};
};
