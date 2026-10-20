import { MASTER_DATA } from '$lib/admin/master-data';
import { error, redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Master data hanya bisa dikelola admin dan kepala sekolah.');
	}

	// Navigasi master data memakai sub menu di sidebar; halaman ini hanya
	// penerusan ke entitas pertama.
	throw redirect(303, `/master-data/${MASTER_DATA[0].key}`);
};
