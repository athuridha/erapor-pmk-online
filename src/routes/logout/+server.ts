import { deleteSessionByToken } from '$lib/server/auth';
import { cookieNames } from '$lib/utils';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(cookieNames.AUTH_SESSION);
	const secure = locals.requestIsSecure ?? false;
	if (token) {
		await deleteSessionByToken(token);
		cookies.delete(cookieNames.AUTH_SESSION, { path: '/', secure });
	}

	// Hapus pilihan kelas supaya login berikutnya mulai dari default
	// (admin & kepala sekolah -> mode "Semua Kelas").
	cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });

	throw redirect(303, '/login');
};
