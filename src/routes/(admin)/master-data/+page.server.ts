import { MASTER_DATA } from '$lib/admin/master-data';
import { loadBarisMaster } from '$lib/admin/master-data.server';
import { error } from '@sveltejs/kit';
import { isAdminUser } from '../../pengguna/permissions';

export const load = async ({ locals }) => {
	const meta: PageMeta = { title: 'Master Data' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || !isAdminUser(user)) {
		throw error(403, 'Master data hanya bisa dikelola admin dan kepala sekolah.');
	}

	const daftar = [];
	for (const entitas of MASTER_DATA) {
		const hasil = await loadBarisMaster(sekolahId, entitas.key, { perPage: 1 });
		daftar.push({ ...entitas, jumlah: hasil.total });
	}

	return { meta, daftar };
};
