import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableAuthUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { applySessionCookie, createSession } from '$lib/server/auth';
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

	// Jika belum dalam mode impersonasi, simpan token sesi asli milik admin
	if (!isImpersonating && activeToken) {
		cookies.set(cookieNames.IMPERSONATOR_SESSION, activeToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure
		});
	}

	// Buat token sesi baru untuk pengguna tujuan
	const userAgent = request.headers.get('user-agent');
	const ipAddress = request.headers.get('x-forwarded-for') || null;
	const { token, expiresAt } = await createSession(targetUser.id, { userAgent, ipAddress });

	applySessionCookie(cookies, token, expiresAt, secure);

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
