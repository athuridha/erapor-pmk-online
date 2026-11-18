import { applySessionCookie, authenticateUser, createSession } from '$lib/server/auth';
import {
	checkLoginBlocked,
	clearLoginAttempts,
	computeDelayMs,
	recordLoginAttempt,
	recentFailureCount,
	remainingAttempts,
	sleep
} from '$lib/server/login-guard';
import { getAppVersion } from '$lib/server/app-info';
import { isSecureRequest, resolveRequestProtocol } from '$lib/server/http';
import { cookieNames } from '$lib/utils';
import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function resolveRedirectTarget(value: string | null) {
	if (!value) return null;
	if (!value.startsWith('/')) return null;
	if (value.startsWith('//')) return null;
	return value;
}

export const load: PageServerLoad = async ({ locals, url, getClientAddress, cookies }) => {
	const isServerLimitActive = process.env.SERVER_LIMIT_ENABLED === 'true';
	const bypassQuery = url.searchParams.get('bypass');
	const bypassCookie = cookies.get('bypass_limit');
	const hasBypass = bypassQuery === 'pmk2026' || bypassCookie === 'pmk2026';

	if (isServerLimitActive && !hasBypass) {
		throw redirect(307, '/server-limit');
	}

	if (locals.user) {
		const target = resolveRedirectTarget(url.searchParams.get('redirect')) ?? '/';
		throw redirect(303, target);
	}

	// Surface an active per-IP lockout right away (even before the user submits
	// the form) so the countdown survives page reloads. Per-username lockouts
	// are covered client-side via localStorage + the 429 response.
	let initialRetryAfterSeconds = 0;
	try {
		const block = await checkLoginBlocked(null, getClientAddress(), { silent: true });
		if (block.blocked) {
			initialRetryAfterSeconds = block.retryAfterSeconds;
		}
	} catch (err) {
		console.warn('[login load] failed to check login lockout', err);
	}

	const meta: PageMeta = {
		title: 'Masuk',
		description:
			'Masuk ke e-Rapor SMK Pratama Mulya Karawang untuk mengelola data penilaian dan rapor.'
	};

	return { meta, appVersion: getAppVersion(), initialRetryAfterSeconds };
};

const LOGIN_LOG_PREFIX = '[login action]';

function logLoginEvent(message: string, details?: Record<string, unknown>) {
	const payload = details ? `${message} ${JSON.stringify(details)}` : message;
	console.info(`${LOGIN_LOG_PREFIX} ${payload}`);
}

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress, url }) => {
		const isServerLimitActive = process.env.SERVER_LIMIT_ENABLED === 'true';
		const bypassQuery = url.searchParams.get('bypass');
		const bypassCookie = cookies.get('bypass_limit');
		const hasBypass = bypassQuery === 'pmk2026' || bypassCookie === 'pmk2026';

		if (isServerLimitActive && !hasBypass) {
			throw redirect(307, '/server-limit');
		}

		const formData = await request.formData();
		const usernameRaw = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const username = usernameRaw.toLowerCase();
		const client = getClientAddress();

		logLoginEvent('Attempt received', {
			username,
			client,
			origin: request.headers.get('origin') ?? undefined,
			referer: request.headers.get('referer') ?? undefined
		});

		if (!usernameRaw || !password) {
			await recordLoginAttempt(username || null, client, false);
			await sleep(300);
			logLoginEvent('Missing credentials', { username, client });
			const remaining = remainingAttempts(await recentFailureCount(username || null, client));
			const suffix = remaining > 0 ? ` Sisa ${remaining}x percobaan sebelum akun terkunci.` : '';
			return fail(400, {
				message: `Nama pengguna / NIK dan kata sandi wajib diisi.${suffix}`
			});
		}

		// Rate limiting / lockout (brute-force protection). A blocked attempt is
		// still recorded so continued hammering keeps extending the lockout.
		const block = await checkLoginBlocked(username, client);
		if (block.blocked) {
			const failures = await recentFailureCount(username, client);
			await recordLoginAttempt(username, client, false);
			await sleep(computeDelayMs(failures + 1));
			logLoginEvent('Blocked by login guard', {
				username,
				client,
				source: block.source,
				retryAfterSeconds: block.retryAfterSeconds
			});
			const minutes = Math.ceil(block.retryAfterSeconds / 60);
			return fail(429, {
				message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`,
				retryAfterSeconds: block.retryAfterSeconds
			});
		}

		const user = await authenticateUser(username, password);
		if (!user) {
			const failures = await recentFailureCount(username, client);
			await recordLoginAttempt(username, client, false);
			await sleep(computeDelayMs(failures + 1));
			logLoginEvent('Invalid credentials', { username, client });
			const remaining = remainingAttempts(failures + 1);
			const suffix = remaining > 0 ? ` Sisa ${remaining}x percobaan sebelum akun terkunci.` : '';
			return fail(401, {
				message: `Nama pengguna / NIK atau kata sandi tidak valid.${suffix}`
			});
		}

		// Successful login: clear the user's own accumulated failures. Per-IP
		// failures from other usernames are left to age out of the window so a
		// shared (NAT) IP cannot be reset by an unrelated successful login.
		await clearLoginAttempts(username);
		await recordLoginAttempt(username, client, true);

		const session = await createSession(user.id, {
			userAgent: request.headers.get('user-agent'),
			ipAddress: client
		});

		logLoginEvent('Authentication success', {
			username,
			userId: user.id,
			expiresAt: session.expiresAt
		});

		const secure = isSecureRequest(request, url);
		const resolvedProtocol = resolveRequestProtocol(request, url);
		logLoginEvent('Setting session cookie', {
			secure,
			protocol: url.protocol,
			resolvedProtocol,
			xForwardedProto: request.headers.get('x-forwarded-proto') ?? undefined,
			forwarded: request.headers.get('forwarded') ?? undefined,
			host: url.host
		});
		applySessionCookie(cookies, session.token, session.expiresAt, secure);

		// Reset module/class cookies based on the signed-in user's role so previous
		// browser sessions never leak another user's selected module or class.
		try {
			const authUser = user as AuthUser & { sekolahId?: number };
			let resolvedSekolahId: number | null = authUser.sekolahId ?? null;

			if (resolvedSekolahId) {
				cookies.set(cookieNames.ACTIVE_SEKOLAH_ID, String(resolvedSekolahId), {
					path: '/',
					secure
				});
			} else if (authUser.type === 'user' && authUser.mataPelajaranId) {
				try {
					const mpRow = await db.query.tableMataPelajaran.findFirst({
						columns: { kelasId: true },
						where: eq(tableMataPelajaran.id, authUser.mataPelajaranId)
					});
					if (mpRow?.kelasId) {
						const kelas = await db.query.tableKelas.findFirst({
							columns: { sekolahId: true },
							where: eq(tableKelas.id, mpRow.kelasId)
						});
						if (kelas?.sekolahId) {
							resolvedSekolahId = kelas.sekolahId;
							cookies.set(cookieNames.ACTIVE_SEKOLAH_ID, String(kelas.sekolahId), {
								path: '/',
								secure
							});
						}
					}
				} catch (err) {
					console.warn(
						'[login action] failed to resolve mata_pelajaran->kelas->sekolah mapping',
						err
					);
				}
			}

			const academic = resolvedSekolahId
				? await resolveSekolahAcademicContext(resolvedSekolahId)
				: null;
			const activeSemesterId = academic?.activeSemesterId ?? null;

			const findHomeroomKelas = async (pegawaiId: number) => {
				const activeMatch = activeSemesterId
					? await db.query.tableKelas.findFirst({
							columns: { id: true, sekolahId: true },
							where: and(
								eq(tableKelas.waliKelasId, pegawaiId),
								eq(tableKelas.semesterId, activeSemesterId)
							)
						})
					: null;
				if (activeMatch) return activeMatch;
				return await db.query.tableKelas.findFirst({
					columns: { id: true, sekolahId: true },
					where: eq(tableKelas.waliKelasId, pegawaiId),
					orderBy: [desc(tableKelas.semesterId)]
				});
			};

			if (authUser.type === 'admin' || authUser.type === 'kepala_sekolah') {
				cookies.set(cookieNames.ACTIVE_MODUL, 'admin', {
					path: '/',
					maxAge: 31536000,
					sameSite: 'lax',
					httpOnly: false,
					secure
				});
				cookies.set(cookieNames.ACTIVE_KELAS_ID, 'semua', {
					path: '/',
					maxAge: 31536000,
					sameSite: 'lax',
					httpOnly: false,
					secure
				});
			} else if (authUser.type === 'wali_kelas') {
				cookies.set(cookieNames.ACTIVE_MODUL, 'wali_kelas', {
					path: '/',
					maxAge: 31536000,
					sameSite: 'lax',
					httpOnly: false,
					secure
				});
				const waliKelas = authUser.pegawaiId ? await findHomeroomKelas(authUser.pegawaiId) : null;
				if (waliKelas) {
					cookies.set(cookieNames.ACTIVE_KELAS_ID, String(waliKelas.id), {
						path: '/',
						httpOnly: false,
						secure
					});
					if (waliKelas.sekolahId) {
						cookies.set(cookieNames.ACTIVE_SEKOLAH_ID, String(waliKelas.sekolahId), {
							path: '/',
							secure
						});
					}
				} else {
					cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
				}
			} else if (authUser.type === 'user') {
				const homeroom = authUser.pegawaiId ? await findHomeroomKelas(authUser.pegawaiId) : null;
				if (homeroom) {
					cookies.set(cookieNames.ACTIVE_MODUL, 'wali_kelas', {
						path: '/',
						maxAge: 31536000,
						sameSite: 'lax',
						httpOnly: false,
						secure
					});
					cookies.set(cookieNames.ACTIVE_KELAS_ID, String(homeroom.id), {
						path: '/',
						httpOnly: false,
						secure
					});
					if (homeroom.sekolahId && !resolvedSekolahId) {
						cookies.set(cookieNames.ACTIVE_SEKOLAH_ID, String(homeroom.sekolahId), {
							path: '/',
							secure
						});
					}
				} else {
					cookies.set(cookieNames.ACTIVE_MODUL, 'guru', {
						path: '/',
						maxAge: 31536000,
						sameSite: 'lax',
						httpOnly: false,
						secure
					});
					cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
				}
			} else if (authUser.type === 'pembina_eskul') {
				cookies.set(cookieNames.ACTIVE_MODUL, 'pembina_eskul', {
					path: '/',
					maxAge: 31536000,
					sameSite: 'lax',
					httpOnly: false,
					secure
				});
				cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
			} else {
				cookies.delete(cookieNames.ACTIVE_MODUL, { path: '/', secure });
				cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
			}
		} catch (err) {
			// non-critical: log but don't block login flow
			console.warn('[login action] failed to set active module/kelas cookies', err);
		}

		// Accounts flagged with mustChangePassword (e.g. the default Admin) will
		// see a modal in the layout after login, and can change password anywhere.
		// No redirect here.

		const target = resolveRedirectTarget(url.searchParams.get('redirect')) ?? '/';
		logLoginEvent('Redirecting after success', { username, target });
		throw redirect(303, target);
	}
};
