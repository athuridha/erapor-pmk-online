import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getD1Config, saveD1Config } from '$lib/server/cloudflare-d1';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Silakan masuk.');
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw error(400, 'Sekolah tidak ditemukan.');

	const config = await getD1Config(sekolahId);
	return json({
		success: true,
		config: {
			accountId: config?.accountId || '',
			databaseId: config?.databaseId || '766ffcd4-c49f-4f29-ab20-dddc0215bb89',
			hasToken: Boolean(config?.apiToken)
		}
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Silakan masuk.');
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw error(400, 'Sekolah tidak ditemukan.');

	const body = await request.json();
	await saveD1Config(sekolahId, {
		accountId: body.accountId || '',
		databaseId: body.databaseId || '766ffcd4-c49f-4f29-ab20-dddc0215bb89',
		apiToken: body.apiToken || ''
	});

	return json({ success: true, message: 'Pengaturan Cloudflare D1 berhasil disimpan.' });
};
