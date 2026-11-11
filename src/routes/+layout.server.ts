import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import {
	tableKelas,
	tablePegawai,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableMataPelajaran,
	tablePresensiSettings
} from '$lib/server/db/schema';
import { cookieNames, findTitleByPath } from '$lib/utils.js';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
	isAdminUser,
	resolveRoutePermission,
	WALI_KELAS_ONLY_PERMISSIONS
} from './pengguna/permissions';
import {
	canAccessKelas,
	kelasKontenSet,
	resolveKelasKonten,
	type KelasLite
} from '$lib/server/kelas-akses';

/** Nilai penanda "di luar kelas" (data diambil dari semua kelas). */
const SEMUA_KELAS = 'semua';

/**
 * Halaman kategori "Mata Pelajaran" — kelas kontennya bisa dibedakan dari
 * kelasAktif global via `?kelas=`. Pada path ini layout menyiapkan pilihan
 * kelas diampu + hasil resolusi `kelasKonten`.
 */
const KELAS_KONTEN_PREFIXES = [
	'/asesmen-formatif',
	'/asesmen-sumatif',
	'/asesmen-kokurikuler',
	'/intrakurikuler',
	'/kokurikuler',
	'/nilai-ekstrakurikuler',
	'/ekstrakurikuler',
	'/jurnal-mengajar'
];

/**
 * Halaman ber-konteks kelas yang belum punya pemilih kelas sendiri. Layout
 * menampilkan pemilih kelas lokal (query `?kelas_id=`, tanpa menulis cookie
 * global) di area konten untuk path ini.
 */
const KELAS_PICKER_PREFIXES = [
	'/presensi-murid',
	'/nilai-akhir',
	'/catatan-wali-kelas',
	'/keputusan',
	'/cetak',
	'/murid',
	'/poin-siswa',
	'/rpm'
];

/** Sub-path yang sudah punya pemilih/filter kelas sendiri → jangan gandakan. */
const KELAS_PICKER_EXCLUDE_PREFIXES = ['/nilai-akhir/impor-nilai', '/murid/form'];

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
	sekolahId: number,
	allowedKelasIds?: Set<number>
): Promise<boolean> {
	if (allowedKelasIds && allowedKelasIds.has(targetKelasId)) return true;

	const ownIds = ownKelasIds.length > 0 ? ownKelasIds : [Number(user.kelasId)];
	if (ownIds.includes(targetKelasId)) return true;

	if (user.pegawaiId) {
		const isPengampu = await db.query.tableMataPelajaran.findFirst({
			columns: { id: true },
			where: and(
				eq(tableMataPelajaran.kelasId, targetKelasId),
				eq(tableMataPelajaran.pengampuId, user.pegawaiId)
			)
		});
		if (isPengampu) return true;
	}

	const hasKelasLink = await db.query.tableAuthUserKelas.findFirst({
		columns: { id: true },
		where: and(
			eq(tableAuthUserKelas.authUserId, user.id!),
			eq(tableAuthUserKelas.kelasId, targetKelasId)
		)
	});
	if (hasKelasLink) return true;

	const requestedKelas = await db.query.tableKelas.findFirst({
		columns: { id: true, waliKelasId: true },
		where: and(eq(tableKelas.id, targetKelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!requestedKelas) return false;

	if (requestedKelas.waliKelasId === user.pegawaiId) return true;

	return false;
}

export const load: LayoutServerLoad = async ({ url, locals, cookies, depends }) => {
	depends('app:presensi-guru-enabled');
	const secure = locals.requestIsSecure ?? false;

	const meta: PageMeta = {
		title:
			url.pathname === '/' ? 'e-Rapor SMK Pratama Mulya Karawang' : findTitleByPath(url.pathname),
		description: 'Aplikasi Administrasi dan Pelaporan Sekolah Khusus SMK Pratama Mulya Karawang',
		logoUrl: '/logo.png'
	};

	const sekolah = locals.sekolah;
	const user = locals.user ?? null;
	const academicContext = sekolah?.id ? await resolveSekolahAcademicContext(sekolah.id) : null;

	// Started early as Promises so they run in parallel with other queries below.
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
	let allUserAllowedKelasIds = new Set<number>();
	const teachingKelasIds = new Set<number>();

	const canAccessAdmin = isAdminUser(user);
	let canAccessWaliKelas = canAccessAdmin || user?.type === 'wali_kelas';
	let activeModul: 'admin' | 'wali_kelas' | 'guru' = canAccessAdmin ? 'admin' : 'guru';

	if (sekolah?.id) {
		const userWithType = user as { type?: string; id?: number; pegawaiId?: number } | null;
		if ((userWithType?.type === 'wali_kelas' || userWithType?.type === 'user') && userWithType.id) {
			const ownKelasPromise = userWithType.pegawaiId
				? db.query.tableKelas.findMany({
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
					})
				: Promise.resolve([]);

			const mapelKelasPromise = userWithType.pegawaiId
				? db.query.tableMataPelajaran.findMany({
						columns: { kelasId: true },
						where: eq(tableMataPelajaran.pengampuId, userWithType.pegawaiId)
					})
				: Promise.resolve([]);

			const allowedKelasPromise = db.query.tableAuthUserKelas.findMany({
				columns: { kelasId: true },
				where: eq(tableAuthUserKelas.authUserId, userWithType.id)
			});

			const [ownKelasRows, mapelKelasRows, allowedKelasRecords] = await Promise.all([
				ownKelasPromise,
				mapelKelasPromise,
				allowedKelasPromise
			]);

			const ownKelasIds = new Set(ownKelasRows.map((r) => r.id));
			resolvedWaliOwnKelasIds = [...ownKelasIds];

			if (resolvedWaliOwnKelasIds.length > 0) {
				canAccessWaliKelas = true;
			}

			const activeModulCookie = cookies.get(cookieNames.ACTIVE_MODUL);
			if (activeModulCookie === 'admin' && canAccessAdmin) {
				activeModul = 'admin';
			} else if (activeModulCookie === 'wali_kelas' && canAccessWaliKelas) {
				activeModul = 'wali_kelas';
			} else if (activeModulCookie === 'guru') {
				activeModul = 'guru';
			} else {
				activeModul = canAccessAdmin ? 'admin' : canAccessWaliKelas ? 'wali_kelas' : 'guru';
			}

			for (const r of mapelKelasRows) {
				teachingKelasIds.add(r.kelasId);
			}

			allUserAllowedKelasIds = new Set([
				...ownKelasIds,
				...allowedKelasRecords.map((r) => r.kelasId),
				...teachingKelasIds
			]);

			// Modul Wali-Kelas hanya memuat kelas binaan wali kelas (tidak mencampur kelas mapel lain)
			// Modul Guru memuat kelas yang benar-benar diajar oleh guru tersebut
			const targetKelasSet =
				activeModul === 'wali_kelas' && ownKelasIds.size > 0
					? ownKelasIds
					: activeModul === 'guru' && teachingKelasIds.size > 0
						? teachingKelasIds
						: allUserAllowedKelasIds;

			if (targetKelasSet.size > 0) {
				daftarKelas = await db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true },
					with: { waliKelas: { columns: { id: true, nama: true } } },
					where: academicContext?.activeSemesterId
						? and(
								eq(tableKelas.sekolahId, sekolah.id),
								inArray(tableKelas.id, [...targetKelasSet]),
								eq(tableKelas.semesterId, academicContext.activeSemesterId)
							)
						: and(
								eq(tableKelas.sekolahId, sekolah.id),
								inArray(tableKelas.id, [...targetKelasSet])
							),
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

	const pathKonteks = url.pathname.replace(/\/+$/, '') || '/';
	const diKelasKonten = KELAS_KONTEN_PREFIXES.some(
		(p) => pathKonteks === p || pathKonteks.startsWith(p + '/')
	);
	const pakaiPickerLokal =
		sekolah?.id != null &&
		user != null &&
		KELAS_PICKER_PREFIXES.some((p) => pathKonteks === p || pathKonteks.startsWith(p + '/')) &&
		!KELAS_PICKER_EXCLUDE_PREFIXES.some(
			(p) => pathKonteks === p || pathKonteks.startsWith(p + '/')
		);

	// Override kelas lewat URL untuk pemilih kelas lokal: `?kelas_id=` (utama)
	// atau `?kelas=` (alias pada halaman non-kelas-konten). Override ini TIDAK
	// mengubah cookie active-kelas-id — hanya konteks halaman saat ini.
	const kelasAliasParam = diKelasKonten ? null : url.searchParams.get('kelas');
	const kelasOverrideRaw = kelasIdParam ?? kelasAliasParam;

	// Admin & kepala sekolah boleh berada "di luar kelas": data diambil dari
	// semua kelas (tanpa filter kelas), dan bisa masuk ke kelas mana saja.
	// Tanpa pilihan kelas eksplisit di URL, Admin selalu default ke mode "Semua Kelas".
	const bolehSemuaKelas = isAdminUser(user);
	let pilihSemuaKelas = false;
	if (bolehSemuaKelas) {
		if (kelasIdParam === SEMUA_KELAS) {
			pilihSemuaKelas = true;
		} else if (kelasIdParam != null) {
			const kelasIdNumber = Number(kelasIdParam);
			pilihSemuaKelas = !Number.isInteger(kelasIdNumber);
		} else if (user?.type === 'admin') {
			// Akun Admin defaultnya selalu Semua Kelas kecuali ada param kelas_id eksplisit
			pilihSemuaKelas = true;
		} else {
			// Tanpa param: pakai cookie kalau ada, selain itu default semua kelas.
			pilihSemuaKelas = kelasCookie == null || kelasCookie === SEMUA_KELAS;
		}
	}

	// Override kelas dari query (pemilih kelas lokal). Divalidasi hak akses:
	// admin/kepala sekolah bebas; guru/wali kelas hanya kelas wali ∪ kelas
	// diampu; wali asuh mengikuti aturan kelas asuhannya.
	let kelasOverride: (typeof daftarKelas)[number] | null = null;
	let paramKelasValid = true;
	if (kelasOverrideRaw != null && kelasOverrideRaw !== SEMUA_KELAS) {
		const overrideId = Number(kelasOverrideRaw);
		if (!Number.isInteger(overrideId) || overrideId <= 0) {
			paramKelasValid = false;
		} else {
			let kandidat: (typeof daftarKelas)[number] | null =
				daftarKelas.find((kelas) => kelas.id === overrideId) ?? null;
			// Modul guru/wali bisa memuat subset kelas; kelas ampu lain di luar
			// subset tetap valid — ambil langsung dari DB.
			if (!kandidat && sekolah?.id) {
				kandidat =
					(await db.query.tableKelas.findFirst({
						columns: { id: true, nama: true, fase: true },
						with: { waliKelas: { columns: { id: true, nama: true } } },
						where: academicContext?.activeSemesterId
							? and(
									eq(tableKelas.id, overrideId),
									eq(tableKelas.sekolahId, sekolah.id),
									eq(tableKelas.semesterId, academicContext.activeSemesterId)
								)
							: and(eq(tableKelas.id, overrideId), eq(tableKelas.sekolahId, sekolah.id))
					})) ?? null;
			}
			if (!kandidat) {
				paramKelasValid = false;
			} else if (isAdminUser(user)) {
				kelasOverride = kandidat;
			} else if (user?.type === 'user' || user?.type === 'wali_kelas') {
				if (allUserAllowedKelasIds.has(overrideId)) kelasOverride = kandidat;
				else paramKelasValid = false;
			} else if (user && sekolah?.id && (await canAccessKelas(user, sekolah.id, overrideId))) {
				kelasOverride = kandidat;
			} else {
				paramKelasValid = false;
			}
		}
	}
	if (kelasOverride) pilihSemuaKelas = false;

	// Wali kelas dengan param kelas di luar haknya tetap diarahkan ke halaman
	// "Akses Ditolak" (perilaku lama), bukan diam-diam memakai kelas lain.
	if (!paramKelasValid && kelasIdParam != null && user?.type === 'wali_kelas') {
		throw redirect(303, `/forbidden?required=kelas_id&src=override`);
	}

	let kelasAktif: (typeof daftarKelas)[number] | null = null;

	// 1) If explicit param provided, prefer it
	if (kelasIdParam != null && !pilihSemuaKelas && paramKelasValid) {
		const kelasIdNumber = Number(kelasIdParam);
		if (Number.isInteger(kelasIdNumber)) {
			if (user) {
				const userWithType = user as WaliKelasUser;
				if (userWithType.type === 'wali_kelas' && Number.isInteger(Number(userWithType.kelasId))) {
					const isAllowed = await verifyWaliKelasAccess(
						userWithType,
						kelasIdNumber,
						resolvedWaliOwnKelasIds,
						sekolah!.id,
						allUserAllowedKelasIds
					);
					if (!isAllowed) {
						throw redirect(303, `/forbidden?required=kelas_id&src=verify`);
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
							sekolah!.id,
							allUserAllowedKelasIds
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

	// 3) If no cookie match, and the user is in Modul Wali-Kelas, prefer their assigned homeroom kelas
	if (!kelasAktif && user && !pilihSemuaKelas && activeModul === 'wali_kelas') {
		const userWithType = user as { type?: string; kelasId?: number };
		if (userWithType.type === 'wali_kelas' || resolvedWaliOwnKelasIds.length > 0) {
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

	// Override URL menang atas cookie/default — tanpa mengubah cookie global.
	if (kelasOverride) kelasAktif = kelasOverride;

	// Bila guru/wali kelas berada di kelas yang tidak dia ampu dan bukan wali-nya,
	// arahkan otomatis ke kelas pertama tempat dia mengajar agar mapel langsung muncul.
	if (
		user &&
		!isAdminUser(user) &&
		(user as { pegawaiId?: number }).pegawaiId &&
		!kelasIdParam &&
		!kelasOverride &&
		kelasAktif &&
		daftarKelas.length > 0
	) {
		const teachesInCurrent = teachingKelasIds.has(kelasAktif.id);
		const isWaliInCurrent =
			activeModul === 'wali_kelas' && resolvedWaliOwnKelasIds.includes(kelasAktif.id);
		if (!teachesInCurrent && !isWaliInCurrent) {
			const candidate = daftarKelas.find((k) => teachingKelasIds.has(k.id));
			if (candidate) {
				kelasAktif = candidate;
				cookies.set(cookieNames.ACTIVE_KELAS_ID, String(candidate.id), {
					path: '/',
					maxAge: 31536000,
					sameSite: 'lax',
					secure
				});
			}
		}
	}

	// Server-side guard: guru on non-own class cannot access wali-kelas-only pages.
	if (user && !isAdminUser(user) && kelasAktif) {
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
	let userForClient = user;
	let hasMataPelajaran = false;

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
			isAdminUser(user) ||
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

	// Set cookies AFTER all async operations are complete. Saat ada override URL
	// (pemilih kelas lokal), cookie sengaja TIDAK diubah agar konteks kelas
	// halaman lain tetap seperti sebelumnya.
	if (kelasOverrideRaw == null) {
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
	}

	const setupNeeded = false;

	// Konteks "kelas konten" per halaman: hanya pada kategori Mata Pelajaran.
	// Guru mapel memilih kelas yang diampu lewat pemilih (?kelas=) tanpa
	// mengubah kelasAktif global. Di luar path ini keduanya kosong.
	let kelasKonten: KelasLite | null = null;
	let kelasKontenPilihan: KelasLite[] = [];
	const pathname = url.pathname.replace(/\/+$/, '');
	const pakaiKelasKonten =
		sekolah?.id != null &&
		user != null &&
		KELAS_KONTEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
	if (pakaiKelasKonten && sekolah?.id) {
		if (isAdminUser(user)) {
			kelasKontenPilihan = daftarKelas.map(({ id, nama, fase }) => ({ id, nama, fase }));
		} else if (user.type === 'user' || user.type === 'wali_kelas') {
			const ids = await kelasKontenSet(user, sekolah.id, academicContext?.activeSemesterId ?? null);
			if (ids.size > 0) {
				const pilihanFilter = academicContext?.activeSemesterId
					? and(
							inArray(tableKelas.id, [...ids]),
							eq(tableKelas.semesterId, academicContext.activeSemesterId)
						)
					: inArray(tableKelas.id, [...ids]);
				kelasKontenPilihan = await db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true },
					where: pilihanFilter,
					orderBy: asc(tableKelas.nama)
				});
			}
		}
		const requested = Number(url.searchParams.get('kelas')) || null;
		kelasKonten = await resolveKelasKonten(
			user as NonNullable<App.Locals['user']>,
			sekolah.id,
			requested,
			kelasAktif ? { id: kelasAktif.id, nama: kelasAktif.nama, fase: kelasAktif.fase } : null,
			academicContext?.activeSemesterId ?? null
		);
	}

	let activeSemesterNama: string | null = null;
	if (academicContext?.activeSemesterId && academicContext.tahunAjaranList) {
		for (const ta of academicContext.tahunAjaranList) {
			const sem = ta.semester?.find((s) => s.id === academicContext.activeSemesterId);
			if (sem) {
				activeSemesterNama = `${sem.nama} (${ta.nama})`;
				break;
			}
		}
	}

	// Pemilih kelas lokal untuk halaman ber-konteks kelas (tanpa cookie global).
	// Pilihan guru dibatasi kelas wali ∪ kelas diampu (bisa melampaui subset
	// modul aktif); admin bebas memilih seluruh kelas semester aktif.
	let pilihanPicker = daftarKelas;
	if (user && !isAdminUser(user) && (user.type === 'user' || user.type === 'wali_kelas')) {
		if (allUserAllowedKelasIds.size > 0 && sekolah?.id) {
			pilihanPicker = await db.query.tableKelas.findMany({
				columns: { id: true, nama: true, fase: true },
				with: { waliKelas: { columns: { id: true, nama: true } } },
				where: academicContext?.activeSemesterId
					? and(
							eq(tableKelas.sekolahId, sekolah.id),
							inArray(tableKelas.id, [...allUserAllowedKelasIds]),
							eq(tableKelas.semesterId, academicContext.activeSemesterId)
						)
					: and(
							eq(tableKelas.sekolahId, sekolah.id),
							inArray(tableKelas.id, [...allUserAllowedKelasIds])
						),
				orderBy: asc(tableKelas.nama)
			});
		} else {
			pilihanPicker = [];
		}
	}
	const kelasPicker = {
		tampil: pakaiPickerLokal && pilihanPicker.length > 0,
		currentId: kelasAktif?.id ?? null,
		bolehSemuaKelas: isAdminUser(user),
		pilihan: pilihanPicker.map(({ id, nama, fase }) => ({ id, nama, fase }))
	};

	return {
		sekolah,
		meta,
		daftarKelas,
		kelasAktif,
		kelasPicker,
		kelasKonten,
		kelasKontenPilihan,
		user: userForClient,
		impersonator: locals.impersonator ?? null,
		hasMataPelajaran,
		presensiGuruEnabled,
		activeSemesterTipe: academicContext?.activeSemesterTipe ?? null,
		activeSemesterNama,
		academicContext,
		activeModul,
		canAccessAdmin,
		canAccessWaliKelas,
		setupNeeded
	};
};
