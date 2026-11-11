import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableAuthUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	applySessionCookie,
	createSession,
	deleteSessionByToken,
	resolveSession
} from '$lib/server/auth';
import { cookieNames } from '$lib/utils';
import { isAdminUser } from '../../../pengguna/permissions';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const current = locals.user;
	if (!current) {
		throw error(401, 'Silakan login terlebih dahulu.');
	}

	const isImpersonating = Boolean(locals.impersonator);
	if (!isAdminUser(current) && !isImpersonating) {
		throw error(403, 'Hanya admin yang dapat beralih akun.');
	}

	let body: { userId?: number | string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Payload tidak valid.');
	}

	const targetId = Number(body.userId);
	if (!Number.isFinite(targetId) || targetId <= 0) {
		throw error(400, 'Target pengguna tidak valid.');
	}

	if (targetId === current.id) {
		throw error(400, 'Tidak dapat beralih ke akun yang sedang aktif.');
	}

	const targetUser = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.id, targetId)
	});
	if (!targetUser) {
		throw error(404, 'Pengguna tujuan tidak ditemukan.');
	}

	const secure = locals.requestIsSecure ?? false;
	const activeToken = cookies.get(cookieNames.AUTH_SESSION);

	// Jika pengguna memilih kembali ke akun admin asal (sesi asli)
	if (isImpersonating && locals.impersonator && targetId === locals.impersonator.id) {
		if (activeToken) {
			await deleteSessionByToken(activeToken).catch(() => {});
		}

		const originalToken = cookies.get(cookieNames.IMPERSONATOR_SESSION);
		const originalSession = originalToken ? await resolveSession(originalToken) : null;

		if (originalSession) {
			applySessionCookie(cookies, originalToken!, originalSession.session.expiresAt, secure);
		} else {
			const userAgent = request.headers.get('user-agent');
			const ipAddress = request.headers.get('x-forwarded-for') || null;
			const { token, expiresAt } = await createSession(targetUser.id, { userAgent, ipAddress });
			applySessionCookie(cookies, token, expiresAt, secure);
		}

		cookies.delete(cookieNames.IMPERSONATOR_SESSION, { path: '/', secure });
		cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });

		return json({
			success: true,
			message: `Kembali ke akun ${targetUser.username}.`,
			user: {
				id: targetUser.id,
				username: targetUser.username,
				type: targetUser.type
			}
		});
	}

	// Jika belum dalam mode impersonasi, simpan token sesi asli milik admin
	if (!isImpersonating && activeToken) {
		cookies.set(cookieNames.IMPERSONATOR_SESSION, activeToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure
		});
	} else if (isImpersonating && activeToken) {
		// Beralih dari satu akun impersonasi ke akun lain: hapus token perantara
		await deleteSessionByToken(activeToken).catch(() => {});
	}

	// Buat token sesi baru untuk pengguna tujuan
	const userAgent = request.headers.get('user-agent');
	const ipAddress = request.headers.get('x-forwarded-for') || null;
	const { token, expiresAt } = await createSession(targetUser.id, { userAgent, ipAddress });

	applySessionCookie(cookies, token, expiresAt, secure);
	cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });

	return json({
		success: true,
		message: `Berhasil beralih ke akun ${targetUser.username}.`,
		user: {
			id: targetUser.id,
			username: targetUser.username,
			type: targetUser.type
		}
	});
};
