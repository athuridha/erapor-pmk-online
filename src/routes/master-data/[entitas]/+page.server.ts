import { MASTER_DATA, cariMasterData } from '$lib/master-data';
import {
	hapusMasterData,
	loadBarisMaster,
	loadOpsiRelasi,
	simpanMasterData
} from '$lib/server/master-data';
import { error, fail } from '@sveltejs/kit';

export const load = async ({ params, locals, url, depends }) => {
	depends('app:master-data');
	const meta: PageMeta = { title: 'Master Data' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Master data hanya bisa dikelola admin dan kepala sekolah.');
	}

	const entitas = cariMasterData(params.entitas ?? '');
	if (!entitas) {
		throw error(404, 'Jenis master data tidak ditemukan');
	}

	const q = url.searchParams.get('q')?.trim() || null;
	const [baris, relasi] = await Promise.all([
		loadBarisMaster(sekolahId, entitas.key, { q }),
		loadOpsiRelasi(sekolahId)
	]);

	return {
		meta: { ...meta, title: `Master Data — ${entitas.judul}` },
		daftar: MASTER_DATA,
		entitas,
		baris,
		relasi,
		filter: { q }
	};
};

export const actions = {
	async simpan({ request, locals, params }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah master data.' });
		}

		const formData = await request.formData();
		const idRaw = Number(formData.get('id') ?? 0);
		const id = Number.isInteger(idRaw) && idRaw > 0 ? idRaw : null;

		const hasil = await simpanMasterData(sekolahId, params.entitas ?? '', id, formData);
		if (hasil.fail) {
			return fail(400, { fail: hasil.fail });
		}
		return { message: hasil.message };
	},

	async hapus({ request, locals, params }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa menghapus master data.' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id') ?? 0);
		const hasil = await hapusMasterData(sekolahId, params.entitas ?? '', id);
		if (hasil.fail) {
			return fail(400, { fail: hasil.fail });
		}
		return { message: hasil.message };
	}
};
