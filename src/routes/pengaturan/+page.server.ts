import {
	applySessionCookie,
	createSession,
	deleteSessionsForUser,
	updateUserPassword,
	verifyUserPassword
} from '$lib/server/auth';
import db from '$lib/server/db';
import { tableAuthUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getAppVersion } from '$lib/server/app-info';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isAdminUser, isFullAdmin } from '../pengguna/permissions';
import { validatePasswordStrength } from '$lib/server/password-policy';
import { isBukuTamuPasskeySet, setBukuTamuPasskey } from '$lib/server/buku-tamu-pass';
import {
	clearAiSettings,
	DEFAULT_AI_MODEL,
	getStoredAiSettings,
	maskApiKey,
	saveAiSettings
} from '$lib/server/ai';
import { isAuthorizedUser } from '../pengguna/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	const meta: PageMeta = {
		title: 'Pengaturan',
		description: 'Pengaturan Aplikasi Administrasi Guru Terpadu'
	};

	const isAdmin = isFullAdmin(locals.user);
	const isAdminOrKepalaSekolah = isAdminUser(locals.user);

	const forcePasswordChange =
		url.searchParams.get('force') === '1' || Boolean(locals.user?.mustChangePassword);

	const bukuTamuPasskeySet =
		isAdminOrKepalaSekolah && locals.sekolah?.id
			? await isBukuTamuPasskeySet(locals.sekolah.id)
			: false;

	const storedGemini = isAdmin ? await getStoredAiSettings() : null;

	return {
		meta,
		appVersion: getAppVersion(),
		// Server-side role flags: admin-only cards below must never render for a
		// non-admin account even if client state is stale (B7).
		canManageUsers: isAdminOrKepalaSekolah,
		canManageDatabase: isAdminOrKepalaSekolah,
		canManageBukuTamu: isAdminOrKepalaSekolah,
		canManageAi: isAdmin,
		canCheckUpdate: isAuthorizedUser(['app_check_update'], locals.user),
		canManageUpdate: isAdminUser(locals.user),
		forcePasswordChange,
		bukuTamuPasskeySet,
		gemini: {
			keySet: Boolean(storedGemini),
			maskedKey: storedGemini ? maskApiKey(storedGemini.apiKey) : null,
			envKeyPresent: Boolean(process.env.GEMINI_API_KEY),
			model: storedGemini?.model ?? DEFAULT_AI_MODEL,
			baseUrl: storedGemini?.baseUrl ?? ''
		}
	};
};

export const actions: Actions = {
	'change-password': async ({ request, locals, cookies, getClientAddress, url }) => {
		const logContext = {
			userId: locals.user?.id,
			client: getClientAddress(),
			origin: request.headers.get('origin') ?? undefined,
			referer: request.headers.get('referer') ?? undefined
		};
		if (!locals.user) {
			console.warn('[change-password] user missing', logContext);
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const currentPassword = String(formData.get('currentPassword') ?? '');
		const newPassword = String(formData.get('newPassword') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		if (!currentPassword || !newPassword || !confirmPassword) {
			console.warn('[change-password] missing fields', logContext);
			return fail(400, { message: 'Semua kolom kata sandi wajib diisi.' });
		}

		const passwordError = validatePasswordStrength(newPassword);
		if (passwordError) {
			console.warn('[change-password] password rejected', { ...logContext, reason: passwordError });
			return fail(400, { message: passwordError });
		}

		if (newPassword !== confirmPassword) {
			console.warn('[change-password] confirmation mismatch', logContext);
			return fail(400, { message: 'Konfirmasi kata sandi tidak cocok.' });
		}

		const valid = await verifyUserPassword(locals.user.id, currentPassword);
		if (!valid) {
			console.warn('[change-password] invalid current password', logContext);
			return fail(400, { message: 'Kata sandi lama tidak sesuai.' });
		}

		await updateUserPassword(locals.user.id, newPassword);
		await deleteSessionsForUser(locals.user.id);
		const session = await createSession(locals.user.id, {
			userAgent: request.headers.get('user-agent'),
			ipAddress: getClientAddress()
		});

		// If the account was forced to change its password (default admin), clear
		// the flag so normal navigation is unlocked again.
		try {
			await db
				.update(tableAuthUser)
				.set({ mustChangePassword: false, updatedAt: new Date().toISOString() })
				.where(eq(tableAuthUser.id, locals.user.id));
		} catch (err) {
			console.warn('[change-password] failed to clear mustChangePassword flag', err);
		}

		console.info('[change-password] success', {
			...logContext,
			sessionExpiresAt: session.expiresAt
		});

		const secure = locals.requestIsSecure ?? url.protocol === 'https:';
		applySessionCookie(cookies, session.token, session.expiresAt, secure);

		return { message: 'Kata sandi berhasil diperbarui.' };
	},
	'change-admin-username': async ({ request, locals }) => {
		const logContext = { userId: locals.user?.id };
		if (!locals.user) {
			console.warn('[change-admin-username] user missing', logContext);
			return fail(403, { message: 'Autentikasi diperlukan.' });
		}

		// Allow the currently authenticated user to change their own username.
		// Require current password for confirmation and ensure username uniqueness.
		const form = await request.formData();
		const newUsername = String(form.get('adminUsername') ?? '').trim();
		const currentPassword = String(form.get('adminPassword') ?? '');

		if (!newUsername) return fail(400, { message: 'Username baru wajib diisi.' });
		if (!currentPassword)
			return fail(400, { message: 'Masukkan kata sandi Anda untuk konfirmasi.' });

		// Verify current password
		const valid = await verifyUserPassword(locals.user.id, currentPassword);
		if (!valid) return fail(400, { message: 'Kata sandi konfirmasi tidak sesuai.' });

		// Server-side validation: match client-side pattern (letters, numbers, dot, underscore, dash) and min length 3
		const usernamePattern = /^[A-Za-z0-9._-]{3,}$/;
		if (!usernamePattern.test(newUsername)) {
			return fail(400, {
				message:
					'Username tidak valid. Gunakan huruf, angka, titik, underscore atau minus. Minimal 3 karakter.'
			});
		}

		const normalized = newUsername.trim().toLowerCase();

		// Check uniqueness excluding current user
		const existing = await db.query.tableAuthUser.findFirst({
			where: eq(tableAuthUser.usernameNormalized, normalized)
		});
		if (existing && existing.id !== locals.user.id)
			return fail(400, { message: 'Username sudah digunakan.' });

		const now = new Date().toISOString();

		await db
			.update(tableAuthUser)
			.set({ username: newUsername, usernameNormalized: normalized, updatedAt: now })
			.where(eq(tableAuthUser.id, locals.user.id));

		return { message: 'Username berhasil diperbarui.' };
	},
	'buku-tamu-passkey': async ({ request, locals }) => {
		if (!isAdminUser(locals.user)) {
			return fail(403, {
				message: 'Hanya admin/kepala sekolah yang dapat mengatur passkey buku tamu.'
			});
		}
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(400, { message: 'Belum ada data sekolah.' });
		}

		const form = await request.formData();
		const passkey = String(form.get('passkey') ?? '');
		const confirm = String(form.get('confirmPasskey') ?? '');

		if (!passkey) {
			return fail(400, { message: 'Passkey wajib diisi.' });
		}
		if (passkey !== confirm) {
			return fail(400, { message: 'Konfirmasi passkey tidak cocok.' });
		}
		if (passkey.length < 4 || passkey.length > 64) {
			return fail(400, { message: 'Passkey harus 4–64 karakter.' });
		}

		await setBukuTamuPasskey(sekolahId, passkey);
		return { message: 'Passkey buku tamu berhasil disimpan.' };
	},
	'buku-tamu-passkey-clear': async ({ locals }) => {
		if (!isAdminUser(locals.user)) {
			return fail(403, {
				message: 'Hanya admin/kepala sekolah yang dapat menonaktifkan passkey buku tamu.'
			});
		}
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(400, { message: 'Belum ada data sekolah.' });
		}

		await setBukuTamuPasskey(sekolahId, null);
		return { message: 'Passkey buku tamu berhasil dinonaktifkan.' };
	},
	'save-gemini-key': async ({ request, locals }) => {
		if (!isFullAdmin(locals.user)) {
			return fail(403, {
				message: 'Hanya admin yang dapat mengatur integrasi AI.'
			});
		}

		const form = await request.formData();
		const apiKey = String(form.get('apiKey') ?? '').trim();
		if (!apiKey) {
			return fail(400, { message: 'Kunci API wajib diisi.' });
		}
		if (apiKey.length < 10) {
			return fail(400, { message: 'Kunci API tidak valid.' });
		}

		const model = String(form.get('model') ?? '').trim() || DEFAULT_AI_MODEL;
		const baseUrl = String(form.get('baseUrl') ?? '').trim();
		if (!baseUrl) {
			return fail(400, { message: 'Base URL wajib diisi.' });
		}

		await saveAiSettings(apiKey, model, baseUrl);
		return { message: 'Kunci API berhasil disimpan.' };
	},
	'clear-gemini-key': async ({ locals }) => {
		if (!isFullAdmin(locals.user)) {
			return fail(403, {
				message: 'Hanya admin yang dapat mengatur integrasi AI.'
			});
		}

		await clearAiSettings();
		return { message: 'Kunci API berhasil dihapus.' };
	}
};
