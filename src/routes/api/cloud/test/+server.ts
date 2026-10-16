import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testD1Connection } from '$lib/server/cloudflare-d1';

export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Silakan masuk terlebih dahulu.');

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw error(400, 'Data sekolah aktif tidak ditemukan.');

	const result = await testD1Connection(sekolahId);
	return json({ success: result.ok, ...result });
};
