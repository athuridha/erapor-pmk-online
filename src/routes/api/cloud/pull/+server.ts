import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pullDataFromCloud } from '$lib/server/cloudflare-d1';

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
		const res = await pullDataFromCloud(sekolahId, user.id);
		return json(res);
	} catch (err: unknown) {
		console.error('[cloud pull error]', err);
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Gagal mengambil data dari database cloud.'
			},
			{ status: 500 }
		);
	}
};
