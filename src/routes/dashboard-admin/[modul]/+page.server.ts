import { loadDetail } from '$lib/server/admin-detail';
import { hapusDataModul } from '$lib/server/admin-hapus';
import { modulAdmin } from '$lib/admin-modul';
import { error, fail } from '@sveltejs/kit';

export const load = async ({ params, locals, url, depends }) => {
	depends('app:dashboard-admin-detail');
	const meta: PageMeta = { title: 'Detail Admin' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Halaman ini khusus admin dan kepala sekolah.');
	}

	const key = params.modul;
	const modul = modulAdmin.find((item) => item.key === key);
	if (!modul) {
		throw error(404, 'Modul tidak ditemukan');
	}

	const q = url.searchParams.get('q')?.trim() || null;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const detail = await loadDetail(sekolahId, key, { q, page });

	return {
		meta: { ...meta, title: `Detail ${modul.judul}` },
		modul,
		detail,
		filter: { q, page: detail.totalHalaman ? page : 1 }
	};
};

export const actions = {
	async hapus({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa menghapus data.' });
		}

		const formData = await request.formData();
		const key = String(formData.get('modul') ?? '');
		const id = Number(formData.get('id') ?? 0);

		const hasil = await hapusDataModul(sekolahId, key, id, { userId: user.id });
		if (hasil.fail) {
			return fail(400, { fail: hasil.fail });
		}
		return { message: hasil.message };
	}
};
