import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableKelas } from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { cookieNames } from '$lib/utils';
import { isAdminUser } from '../../pengguna/permissions';
import { and, eq } from 'drizzle-orm';

const VALID_MODULES = new Set(['admin', 'wali_kelas', 'guru', 'pembina_eskul']);

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	const user = locals.user;
	if (!user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	let body: { modul?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ success: false, message: 'Invalid JSON' }, { status: 400 });
	}

	const requested = typeof body.modul === 'string' ? body.modul.trim() : '';
	if (!VALID_MODULES.has(requested)) {
		return json({ success: false, message: 'Modul tidak valid' }, { status: 400 });
	}

	const canAdmin = isAdminUser(user);
	let canWali = canAdmin || user.type === 'wali_kelas';
	if (!canWali && user.pegawaiId && locals.sekolah?.id) {
		const academic = await resolveSekolahAcademicContext(locals.sekolah.id);
		const own = await db.query.tableKelas.findFirst({
			columns: { id: true },
			where: academic?.activeSemesterId
				? and(
						eq(tableKelas.sekolahId, locals.sekolah.id),
						eq(tableKelas.waliKelasId, user.pegawaiId),
						eq(tableKelas.semesterId, academic.activeSemesterId)
					)
				: and(
						eq(tableKelas.sekolahId, locals.sekolah.id),
						eq(tableKelas.waliKelasId, user.pegawaiId)
					)
		});
		if (own) canWali = true;
	}

	let resolved: 'admin' | 'wali_kelas' | 'guru' | 'pembina_eskul';
	if (user.type === 'pembina_eskul') {
		resolved = 'pembina_eskul';
	} else if (requested === 'admin' && canAdmin) {
		resolved = 'admin';
	} else if (requested === 'wali_kelas' && canWali) {
		resolved = 'wali_kelas';
	} else if (requested === 'guru') {
		resolved = 'guru';
	} else {
		return json({ success: false, message: 'Akses modul ditolak' }, { status: 403 });
	}

	const secure = locals.requestIsSecure ?? false;
	cookies.set(cookieNames.ACTIVE_MODUL, resolved, {
		path: '/',
		maxAge: 31536000,
		sameSite: 'lax',
		httpOnly: false,
		secure
	});

	if (resolved === 'admin') {
		cookies.set(cookieNames.ACTIVE_KELAS_ID, 'semua', {
			path: '/',
			maxAge: 31536000,
			sameSite: 'lax',
			httpOnly: false,
			secure
		});
	} else {
		cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
	}

	return json({ success: true, modul: resolved });
};
