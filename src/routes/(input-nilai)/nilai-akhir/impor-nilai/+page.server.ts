import {
	daftarKelasImpor,
	parseBerkasNilai,
	simpanImporNilai,
	type JenisImpor
} from '$lib/admin/impor-nilai.server';
import { fail } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
	const meta: PageMeta = { title: 'Impor Nilai dari Excel' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		return { meta, daftarKelas: [], jenis: 'sumatif' as JenisImpor, preview: null };
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		return { meta, daftarKelas: [], jenis: 'sumatif' as JenisImpor, preview: null };
	}

	const jenis = (
		url.searchParams.get('jenis') === 'formatif' ? 'formatif' : 'sumatif'
	) as JenisImpor;
	const daftarKelas = await daftarKelasImpor(sekolahId);

	return { meta, daftarKelas, jenis, preview: null };
};

export const actions = {
	async preview({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan.' });
		const formData = await request.formData();
		const kelasId = Number(formData.get('kelasId') ?? 0);
		const jenis =
			String(formData.get('jenis') ?? 'sumatif') === 'formatif' ? 'formatif' : 'sumatif';
		const berkas = formData.get('berkas');
		if (!kelasId) return fail(400, { fail: 'Pilih kelas terlebih dahulu.' });
		if (!(berkas instanceof File) || berkas.size === 0) {
			return fail(400, { fail: 'Pilih berkas .xlsx yang berisi nilai.' });
		}

		const buffer = Buffer.from(await berkas.arrayBuffer());
		try {
			const hasil = await parseBerkasNilai(sekolahId, kelasId, jenis, buffer);
			return { preview: hasil, kelasId, jenis };
		} catch (error) {
			console.warn('[impor-nilai] parse gagal:', error);
			return fail(400, { fail: 'Berkas tidak bisa dibaca. Pastikan format .xlsx.' });
		}
	},

	async simpan({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan.' });
		const user = locals.user;
		if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengimpor nilai.' });
		}
		const formData = await request.formData();
		const kelasId = Number(formData.get('kelasId') ?? 0);
		const jenis =
			String(formData.get('jenis') ?? 'sumatif') === 'formatif' ? 'formatif' : 'sumatif';
		const berkas = formData.get('berkas');
		if (!kelasId) return fail(400, { fail: 'Pilih kelas terlebih dahulu.' });
		if (!(berkas instanceof File) || berkas.size === 0) {
			return fail(400, { fail: 'Pilih berkas .xlsx yang berisi nilai.' });
		}

		const buffer = Buffer.from(await berkas.arrayBuffer());
		const hasil = await parseBerkasNilai(sekolahId, kelasId, jenis, buffer);
		if (!hasil.ok) {
			return fail(400, {
				fail: hasil.pesanUmum[0] ?? 'Berkas tidak valid. Periksa kembali isiannya.'
			});
		}

		const { tersimpan, dilewati } = await simpanImporNilai(sekolahId, kelasId, jenis, hasil, {
			userId: user.id,
			nama: user.username
		});

		return {
			message: `Import selesai: ${tersimpan} nilai tersimpan${dilewati ? `, ${dilewati} dilewati` : ''}.`
		};
	}
};
