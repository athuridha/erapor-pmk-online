import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pushMasterDataToCloud } from '$lib/server/cloud-master';

/**
 * Kirim master data (sekolah, pegawai, kelas, siswa, akun pengguna) ke Database Pusat.
 * Dipakai supaya instalasi baru bisa menarik data ini dari halaman /siapkan sebelum login.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Silakan masuk terlebih dahulu.');
	}

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw error(400, 'Data sekolah aktif tidak ditemukan.');
	}

	try {
		const res = await pushMasterDataToCloud(sekolahId, user.id);
		return json(res);
	} catch (err: unknown) {
		console.error('[cloud push-master error]', err);
		return json(
			{
				success: false,
				message:
					err instanceof Error ? err.message : 'Gagal mengirim master data ke Database Pusat.'
			},
			{ status: 500 }
		);
	}
};
