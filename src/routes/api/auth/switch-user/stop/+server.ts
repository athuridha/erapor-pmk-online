import { json, error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableAuthUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveSession, deleteSessionByToken, applySessionCookie } from '$lib/server/auth';
import { cookieNames } from '$lib/utils';
import { isAdminUser } from '../../../../pengguna/permissions';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const current = locals.user;
	if (!current) {
		throw error(401, 'Silakan login terlebih dahulu.');
	}

	const originalToken = cookies.get(cookieNames.IMPERSONATOR_SESSION);
	if (!originalToken && !locals.impersonator) {
		throw error(400, 'Anda tidak sedang dalam mode switch akun.');
	}

	const secure = locals.requestIsSecure ?? false;
	const originalSession = originalToken ? await resolveSession(originalToken) : null;

	// Hapus sesi sementara pengguna yang di-switch agar tidak menumpuk di database
	const currentSessionToken = cookies.get(cookieNames.AUTH_SESSION);
	if (currentSessionToken) {
		await deleteSessionByToken(currentSessionToken).catch(() => {});
	}

	const acceptsHtml = request.headers.get('accept')?.includes('text/html');

	// Fallback bila sesi admin asal di tabel kedaluwarsa, tetapi data impersonator masih terverifikasi
	if (!originalSession && locals.impersonator) {
		const adminUser = await db.query.tableAuthUser.findFirst({
			where: eq(tableAuthUser.id, locals.impersonator.id)
		});
		if (adminUser && isAdminUser(adminUser)) {
			const { createSession } = await import('$lib/server/auth');
			const userAgent = request.headers.get('user-agent');
			const ipAddress = request.headers.get('x-forwarded-for') || null;
			const { token, expiresAt } = await createSession(adminUser.id, { userAgent, ipAddress });
			applySessionCookie(cookies, token, expiresAt, secure);
			cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });
			cookies.set(cookieNames.ACTIVE_KELAS_ID, 'semua', {
				path: '/',
				sameSite: 'lax',
				secure
			});
			cookies.set(cookieNames.ACTIVE_MODUL, 'admin', {
				path: '/',
				sameSite: 'lax',
				secure
			});
			if (acceptsHtml) {
				throw redirect(303, '/');
			}
			return json({
				success: true,
				redirect: '/',
				message: `Kembali ke akun ${adminUser.username}.`
			});
		}
	}

	if (!originalSession) {
		cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });
		throw error(401, 'Sesi admin asal sudah kedaluwarsa. Silakan login kembali.');
	}

	// Kembalikan cookie AUTH_SESSION ke sesi admin asal
	applySessionCookie(cookies, originalToken!, originalSession.session.expiresAt, secure);
	cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });
	cookies.set(cookieNames.ACTIVE_KELAS_ID, 'semua', {
		path: '/',
		sameSite: 'lax',
		secure
	});
	cookies.set(cookieNames.ACTIVE_MODUL, 'admin', {
		path: '/',
		sameSite: 'lax',
		secure
	});

	if (acceptsHtml) {
		throw redirect(303, '/');
	}

	return json({
		success: true,
		redirect: '/',
		message: `Kembali ke akun ${originalSession.user.username}.`
	});
};
