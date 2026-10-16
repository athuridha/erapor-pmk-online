import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { approveCloudPackage, rejectCloudPackage } from '$lib/server/cloudflare-d1';
import { isAuthorizedUser } from '../../../pengguna/permissions';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Silakan masuk terlebih dahulu.');
	}

	// Hanya Admin / Operator yang berhak menyetujui paket nilai
	const canApprove = user.type === 'admin' || isAuthorizedUser(['administrasi_sinkronisasi'], user);
	if (!canApprove) {
		throw error(403, 'Hanya Operator / Admin yang berhak menyetujui konsolidasi nilai.');
	}

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw error(400, 'Data sekolah aktif tidak ditemukan.');
	}

	const body = await request.json().catch(() => ({}));
	const { packageId, action, notes } = body;

	if (!packageId) {
		throw error(400, 'ID paket tidak valid.');
	}

	try {
		if (action === 'REJECT') {
			const res = await rejectCloudPackage(packageId, sekolahId, notes || '');
			return json(res);
		} else {
			const res = await approveCloudPackage(packageId, sekolahId, user.id);
			return json(res);
		}
	} catch (err: unknown) {
		console.error('[cloud approve error]', err);
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Gagal memproses persetujuan paket nilai.'
			},
			{ status: 500 }
		);
	}
};
