import { MASTER_DATA } from '$lib/master-data';
import { error, redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
	const meta: PageMeta = { title: 'Master Data' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Master data hanya bisa dikelola admin dan kepala sekolah.');
	}

	const entitas = url.searchParams.get('entitas');
	if (entitas && MASTER_DATA.some((item) => item.key === entitas)) {
		throw redirect(303, `/master-data/${entitas}`);
	}

	return { meta, daftar: MASTER_DATA };
};
