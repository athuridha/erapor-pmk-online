import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncMasterFromCloud } from '$lib/server/cloud-master';

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
		const res = await syncMasterFromCloud(sekolahId, user.id);
		if (!res.success) {
			return json({ success: false, error: res.message }, { status: 400 });
		}
		return json({
			success: true,
			message: res.message,
			recordsCount: res.totalRecords,
			details: res.counts,
			mode: res.mode,
			merge: res.merge
		});
	} catch (err: unknown) {
		console.error('[cloud pull error]', err);
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Gagal menyinkronkan data dari Database Pusat.'
			},
			{ status: 500 }
		);
	}
};
