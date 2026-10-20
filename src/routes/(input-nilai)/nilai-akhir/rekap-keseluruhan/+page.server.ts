import { buildRekapKeseluruhan, daftarKelasSekolah } from '$lib/server/rekap-keseluruhan';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { error } from '@sveltejs/kit';

export const load = async ({ parent, locals, url, depends }) => {
	depends('app:nilai-akhir-rekap-keseluruhan');
	const meta: PageMeta = { title: 'Rekap Nilai Keseluruhan' };
	const { kelasAktif } = await parent();
	const sekolahId = locals.sekolah?.id ?? null;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}

	// Kelas yang dipilih bisa lewat query param (dipilih dari daftar kelas di
	// database), default-nya kelas aktif.
	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	const targetKelasId =
		Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : Number(kelasAktif?.id ?? 0);
	if (!targetKelasId) {
		throw error(400, 'Pilih kelas terlebih dahulu');
	}
	if (!(await canAccessKelas(locals.user, sekolahId, targetKelasId))) {
		throw error(403, 'Anda tidak memiliki akses ke kelas ini.');
	}

	const semuaKelas = await daftarKelasSekolah(sekolahId);
	const user = locals.user;
	const tanpaBatasan = user?.type === 'admin' || user?.type === 'kepala_sekolah';
	const daftarKelas = tanpaBatasan
		? semuaKelas
		: (
				await Promise.all(
					semuaKelas.map(async (kelas) => ({
						kelas,
						boleh: await canAccessKelas(user, sekolahId, kelas.id)
					}))
				)
			)
				.filter((item) => item.boleh)
				.map((item) => item.kelas);

	const rekap = await buildRekapKeseluruhan(sekolahId, targetKelasId);

	return { meta, rekap, daftarKelas };
};
