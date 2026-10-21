import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import {
	tableKelas,
	tablePegawai,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tablePresensiSettings
} from '$lib/server/db/schema';
import { cookieNames, findTitleByPath } from '$lib/utils.js';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { resolveRoutePermission, WALI_KELAS_ONLY_PERMISSIONS } from './pengguna/permissions';
import { isLocalMasterEmpty } from '$lib/server/cloud-master';

/** Nilai penanda "di luar kelas" (data diambil dari semua kelas). */
const SEMUA_KELAS = 'semua';

type WaliKelasUser = {
	type?: string;
	id?: number;
	kelasId?: number;
	pegawaiId?: number;
	permissions?: string[];
};

/**
 * Verify whether a wali_kelas user is allowed to access the given kelas.
 * Returns true if the kelas is their own, or if they have kelas_pindah
 * permission AND the kelas is linked to them via waliKelasId or auth_user_kelas.
 */
async function verifyWaliKelasAccess(
	user: WaliKelasUser,
	targetKelasId: number,
	ownKelasIds: number[],
	sekolahId: number
): Promise<boolean> {
	const ownIds = ownKelasIds.length > 0 ? ownKelasIds : [Number(user.kelasId)];
	if (ownIds.includes(targetKelasId)) return true;

	const hasPindah = Array.isArray(user.permissions)
		? user.permissions.includes('kelas_pindah')
		: false;
	if (!hasPindah) return false;

	const requestedKelas = await db.query.tableKelas.findFirst({
		columns: { id: true, waliKelasId: true },
		where: and(eq(tableKelas.id, targetKelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!requestedKelas) return false;

	if (requestedKelas.waliKelasId === user.pegawaiId) return true;

	const hasKelasLink = await db.query.tableAuthUserKelas.findFirst({
		columns: { id: true },
		where: and(
			eq(tableAuthUserKelas.authUserId, user.id!),
			eq(tableAuthUserKelas.kelasId, targetKelasId)
		)
	});
	return !!hasKelasLink;
}

export const load: LayoutServerLoad = async ({ url, locals, cookies, depends }) => {
	depends('app:presensi-guru-enabled');

	const meta: PageMeta = {
		title:
			url.pathname === '/' ? 'e-Rapor SMK Pratama Mulya Karawang' : findTitleByPath(url.pathname),
		description: 'Aplikasi Administrasi dan Pelaporan Sekolah Khusus SMK Pratama Mulya Karawang',
		logoUrl: '/logo.png'
	};

	const sekolah = locals.sekolah;
	const user = locals.user ?? null;
	const academicContext = sekolah?.id ? await resolveSekolahAcademicContext(sekolah.id) : null;

	// Presensi guru feature toggle (per active sekolah + tahun ajaran). Defaults to
	// enabled so existing installs keep the feature visible.
	// Started early as a Promise so it runs in parallel with daftarKelas queries below.
	let presensiGuruEnabled = true;
	const presensiPromise =
		sekolah?.id && academicContext?.activeTahunAjaranId
			? db.query.tablePresensiSettings.findFirst({
					columns: { presensiGuruEnabled: true },
					where: and(
						eq(tablePresensiSettings.sekolahId, sekolah.id),
						eq(tablePresensiSettings.tahunAjaranId, academicContext.activeTahunAjaranId)
					)
				})
			: null;

	// Query daftarKelas: for wali_kelas, get ALL kelas they manage (not just active semester)
	// For user type (guru), get kelas from tableAuthUserKelas join table
	// For other users, get kelas from active semester only
	let daftarKelas: Array<{
		id: number;
		nama: string;
		fase: string | null;
		waliKelas: { id: number; nama: string } | null;
	}> = [];
	// Resolved wali kelas IDs for the active semester
	let resolvedWaliOwnKelasIds: number[] = [];
	if (sekolah?.id) {
		const userWithType = user as { type?: string; id?: number; pegawaiId?: number } | null;
		if ((userWithType?.type === 'wali_kelas' || userWithType?.type === 'user') && userWithType.id) {
			let ownKelasIds = new Set<number>();
			if (userWithType.pegawaiId) {
				const ownKelasRows = await db.query.tableKelas.findMany({
					columns: { id: true },
					where: academicContext?.activeSemesterId
						? and(
								eq(tableKelas.sekolahId, sekolah.id),
								eq(tableKelas.waliKelasId, userWithType.pegawaiId),
								eq(tableKelas.semesterId, academicContext.activeSemesterId)
							)
						: and(
								eq(tableKelas.sekolahId, sekolah.id),
								eq(tableKelas.waliKelasId, userWithType.pegawaiId)
							)
				});
				ownKelasIds = new Set(ownKelasRows.map((r) => r.id));
				resolvedWaliOwnKelasIds = [...ownKelasIds];
			}

			const allowedKelasRecords = await db.query.tableAuthUserKelas.findMany({
				columns: { kelasId: true },
				where: eq(tableAuthUserKelas.authUserId, userWithType.id)
			});
			const allKelasIds = new Set([...ownKelasIds, ...allowedKelasRecords.map((r) => r.kelasId)]);

			if (allKelasIds.size > 0) {
				daftarKelas = await db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true },
					with: { waliKelas: { columns: { id: true, nama: true } } },
					where: academicContext?.activeSemesterId
						? and(
								eq(tableKelas.sekolahId, sekolah.id),
								inArray(tableKelas.id, [...allKelasIds]),
								eq(tableKelas.semesterId, academicContext.activeSemesterId)
							)
						: and(eq(tableKelas.sekolahId, sekolah.id), inArray(tableKelas.id, [...allKelasIds])),
					orderBy: asc(tableKelas.nama)
				});
			} else {
				// Fallback bila guru belum memiliki batasan kelas: tampilkan seluruh kelas aktif
				daftarKelas = await db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true },
					with: { waliKelas: { columns: { id: true, nama: true } } },
					where: academicContext?.activeSemesterId
						? and(
								eq(tableKelas.sekolahId, sekolah.id),
								eq(tableKelas.semesterId, academicContext.activeSemesterId)
							)
						: eq(tableKelas.sekolahId, sekolah.id),
					orderBy: asc(tableKelas.nama)
				});
			}
		} else {
			// Admin/other: get kelas from active semester only
			daftarKelas = await db.query.tableKelas.findMany({
				columns: { id: true, nama: true, fase: true },
				with: { waliKelas: { columns: { id: true, nama: true } } },
				where: academicContext?.activeSemesterId
					? and(
							eq(tableKelas.sekolahId, sekolah.id),
							eq(tableKelas.semesterId, academicContext.activeSemesterId)
						)
					: eq(tableKelas.sekolahId, sekolah.id),
				orderBy: asc(tableKelas.nama)
			});
		}
	}

	const kelasIdParam = url.searchParams.get('kelas_id');
	const kelasCookie = cookies.get(cookieNames.ACTIVE_KELAS_ID);

	// Admin & kepala sekolah boleh berada "di luar kelas": data diambil dari
	// semua kelas (tanpa filter kelas), dan bisa masuk ke kelas mana saja.
	const bolehSemuaKelas = user?.type === 'admin' || user?.type === 'kepala_sekolah';
	let pilihSemuaKelas = false;
	if (bolehSemuaKelas) {
		if (kelasIdParam === SEMUA_KELAS) pilihSemuaKelas = true;
		else if (kelasIdParam == null && kelasCookie === SEMUA_KELAS) pilihSemuaKelas = true;
	}

	let kelasAktif: (typeof daftarKelas)[number] | null = null;

	// 1) If explicit param provided, prefer it
	if (kelasIdParam != null && !pilihSemuaKelas) {
		const kelasIdNumber = Number(kelasIdParam);
		if (Number.isInteger(kelasIdNumber)) {
			if (user) {
				const userWithType = user as WaliKelasUser;
				if (userWithType.type === 'wali_kelas' && Number.isInteger(Number(userWithType.kelasId))) {
					const isAllowed = await verifyWaliKelasAccess(
						userWithType,
						kelasIdNumber,
						resolvedWaliOwnKelasIds,
						sekolah!.id
					);
					if (!isAllowed) {
						throw redirect(303, `/forbidden?required=kelas_id`);
					}
				}
			}
			kelasAktif = daftarKelas.find((kelas) => kelas.id === kelasIdNumber) ?? null;
		}
	}

	// 2) Fall back to cookie candidate
	if (!kelasAktif && kelasCookie && !pilihSemuaKelas) {
		const kelasCookieNumber = Number(kelasCookie);
		if (Number.isInteger(kelasCookieNumber)) {
			kelasAktif = daftarKelas.find((kelas) => kelas.id === kelasCookieNumber) ?? null;

			// For wali_kelas: verify cookie kelas is allowed (same rules as param)
			if (kelasAktif && user) {
				const userWithType = user as WaliKelasUser;
				if (userWithType.type === 'wali_kelas' && Number.isInteger(Number(userWithType.kelasId))) {
					try {
						const isAllowed = await verifyWaliKelasAccess(
							userWithType,
							kelasCookieNumber,
							resolvedWaliOwnKelasIds,
							sekolah!.id
						);
						if (!isAllowed) kelasAktif = null;
					} catch (err) {
						console.warn('[layout] cookie kelas verification failed', err);
						kelasAktif = null;
					}
				}
			}
		}
	}

	// 3) If no cookie match, and the user is a wali_kelas/kepala_sekolah, prefer their assigned kelas
	if (!kelasAktif && user && !pilihSemuaKelas) {
		const userWithType = user as { type?: string; kelasId?: number };
		if (userWithType.type === 'wali_kelas' && userWithType.kelasId) {
			const resolvedId =
				resolvedWaliOwnKelasIds.length > 0
					? resolvedWaliOwnKelasIds[0]
					: Number(userWithType.kelasId);
			if (Number.isInteger(resolvedId)) {
				kelasAktif = daftarKelas.find((kelas) => kelas.id === resolvedId) ?? null;
				if (!kelasAktif) {
					const kelasRecord = await db.query.tableKelas.findFirst({
						columns: { id: true, nama: true, fase: true },
						where: eq(tableKelas.id, resolvedId)
					});
					if (kelasRecord) {
						kelasAktif = daftarKelas.find((k) => k.nama === kelasRecord.nama) ?? null;
					}
				}
			}
		}
	}

	// 3.5) A kepala_sekolah who also serves as wali kelas (PLT keeping teaching
	// hours) defaults to their assigned class on first login (no cookie yet).
	// Runs after the cookie step so a manually chosen kelas is always respected.
	if (!kelasAktif && user && sekolah?.id && !pilihSemuaKelas) {
		const userWithType = user as { type?: string; pegawaiId?: number };
		if (userWithType.type === 'kepala_sekolah' && userWithType.pegawaiId) {
			const waliKelasRecord = await db.query.tableKelas.findFirst({
				columns: { id: true, nama: true, fase: true },
				where: academicContext?.activeSemesterId
					? and(
							eq(tableKelas.sekolahId, sekolah.id),
							eq(tableKelas.waliKelasId, userWithType.pegawaiId),
							eq(tableKelas.semesterId, academicContext.activeSemesterId)
						)
					: and(
							eq(tableKelas.sekolahId, sekolah.id),
							eq(tableKelas.waliKelasId, userWithType.pegawaiId)
						)
			});
			if (waliKelasRecord) {
				kelasAktif = daftarKelas.find((kelas) => kelas.id === waliKelasRecord.id) ?? null;
				if (!kelasAktif) {
					kelasAktif = daftarKelas.find((kelas) => kelas.nama === waliKelasRecord.nama) ?? null;
				}
			}
		}
	}

	if (!kelasAktif && daftarKelas.length && !pilihSemuaKelas) {
		kelasAktif = daftarKelas[0];
	}

	// Server-side guard: guru on non-own class cannot access wali-kelas-only pages.
	if (user && user.type !== 'admin' && user.type !== 'kepala_sekolah' && kelasAktif) {
		const isOwnClass = resolvedWaliOwnKelasIds.includes(kelasAktif.id);
		if (!isOwnClass) {
			const required = resolveRoutePermission(url.pathname);
			if (required && WALI_KELAS_ONLY_PERMISSIONS.has(required)) {
				throw redirect(303, `/forbidden?required=${required}`);
			}
		}
	}

	// Enrich user with pegawai name when possible so client can display the
	// human-readable name (e.g. in navbar alerts). Keep original shape
	// otherwise. Also attach a small permission flag so client can easily
	// disable UI for restricted 'user' accounts.
	// Start pegawai + hasMataPelajaran queries as promises (run in parallel via await below).
	let userForClient = user;
	let hasMataPelajaran = false;
	const pegawaiPromise = user?.pegawaiId
		? db.query.tablePegawai.findFirst({
				columns: { id: true, nama: true },
				where: eq(tablePegawai.id, Number(user.pegawaiId))
			})
		: null;
	const hasMapelPromise =
		user?.type === 'user' &&
		!(user as { mataPelajaranId?: number | null }).mataPelajaranId &&
		user.id
			? db.query.tableAuthUserMataPelajaran.findMany({
					columns: { id: true },
					where: eq(tableAuthUserMataPelajaran.authUserId, user.id),
					limit: 1
				})
			: null;

	// Resolve all parallel promises at once
	const [presensiSetting, pegawaiRecord, hasMapelRecords] = await Promise.all([
		presensiPromise,
		pegawaiPromise,
		hasMapelPromise
	]);
	if (presensiSetting) presensiGuruEnabled = presensiSetting.presensiGuruEnabled ?? true;

	if (user) {
		const userType = (user as { type?: string }).type;
		const canManageMapel = true;
		const isOwnKelas = kelasAktif != null && resolvedWaliOwnKelasIds.includes(kelasAktif.id);
		const canEditUrutan =
			userType === 'admin' ||
			userType === 'kepala_sekolah' ||
			userType === 'wali_kelas' ||
			// Guru merangkap wali kelas (type 'user'): boleh mengatur kelas diwali-nya.
			(userType === 'user' && isOwnKelas);
		const canAddImportMapel = canEditUrutan;

		const resolvedKelasId =
			(userType === 'wali_kelas' || (userType === 'user' && resolvedWaliOwnKelasIds.length > 0)) &&
			resolvedWaliOwnKelasIds.length > 0
				? resolvedWaliOwnKelasIds[0]
				: user.kelasId;

		userForClient = Object.assign({}, user, {
			kelasId: resolvedKelasId,
			ownKelasIds: resolvedWaliOwnKelasIds,
			pegawaiName: pegawaiRecord?.nama ?? null,
			canManageMapel,
			canEditUrutan,
			canAddImportMapel
		});
	}

	if (user?.type === 'user') {
		const u = user as { id?: number; mataPelajaranId?: number | null };
		hasMataPelajaran =
			!!u.mataPelajaranId || (hasMapelRecords ? hasMapelRecords.length > 0 : false);
	}

	// Set cookies AFTER all async operations are complete
	const secure = locals.requestIsSecure ?? false;
	if (pilihSemuaKelas) {
		// Mode "di luar kelas": simpan penanda agar tetap aktif di halaman lain.
		cookies.set(cookieNames.ACTIVE_KELAS_ID, SEMUA_KELAS, {
			path: '/',
			secure
		});
	} else if (kelasAktif) {
		cookies.set(cookieNames.ACTIVE_KELAS_ID, String(kelasAktif.id), {
			path: '/',
			secure
		});
	} else {
		cookies.delete(cookieNames.ACTIVE_KELAS_ID, { path: '/', secure });
	}

	let setupNeeded = false;
	if (!user) {
		try {
			setupNeeded = await isLocalMasterEmpty();
		} catch {
			setupNeeded = false;
		}
	}

	return {
		sekolah,
		meta,
		daftarKelas,
		kelasAktif,
		user: userForClient,
		impersonator: locals.impersonator ?? null,
		hasMataPelajaran,
		presensiGuruEnabled,
		activeSemesterTipe: academicContext?.activeSemesterTipe ?? null,
		academicContext,
		setupNeeded
	};
};
