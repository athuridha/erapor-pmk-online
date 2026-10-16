import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSession, applySessionCookie } from '$lib/server/auth';
import { cookieNames } from '$lib/utils';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	const current = locals.user;
	if (!current) {
		throw error(401, 'Silakan login terlebih dahulu.');
	}

	const originalToken = cookies.get(cookieNames.IMPERSONATOR_SESSION);
	if (!originalToken) {
		throw error(400, 'Anda tidak sedang dalam mode switch akun.');
	}

	const secure = locals.requestIsSecure ?? false;
	const originalSession = await resolveSession(originalToken);

	if (!originalSession) {
		cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });
		throw error(401, 'Sesi admin asal sudah kedaluwarsa. Silakan login kembali.');
	}

	// Kembalikan cookie AUTH_SESSION ke sesi admin asal
	applySessionCookie(cookies, originalToken, originalSession.session.expiresAt, secure);
	cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });

	return json({
		success: true,
		message: `Kembali ke akun ${originalSession.user.username}.`
	});
};
