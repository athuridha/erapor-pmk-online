import { and, eq, inArray, or, sql } from 'drizzle-orm';
import db from './db';
import {
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableKelas,
	tableMurid,
	tableMataPelajaran,
	tablePegawai
} from './db/schema';
import { isAdminUser } from '../../routes/pengguna/permissions';

/**
 * True bila `user` adalah wali kelas dari `kelasId` (lewat relasi waliKelasId).
 * Selalu dibaca dari DB agar tidak bergantung pada kolom `auth_user.kelasId`
 * yang bisa basi saat wali pindah kelas.
 */
export async function isWaliOfKelas(
	user: { type?: string; pegawaiId?: number | null } | null | undefined,
	kelasId: number
): Promise<boolean> {
	if (!user || !user.pegawaiId) return false;
	const own = await db.query.tableKelas.findFirst({
		columns: { id: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, user.pegawaiId))
	});
	return !!own;
}

/** Set semua kelas yang diwali seseorang (lewat relasi waliKelasId). */
export async function ownedKelasIdSet(
	user: { pegawaiId?: number | null } | null | undefined
): Promise<Set<number>> {
	if (!user?.pegawaiId) return new Set();
	const rows = await db.query.tableKelas.findMany({
		columns: { id: true },
		where: eq(tableKelas.waliKelasId, user.pegawaiId)
	});
	return new Set(rows.map((r) => r.id));
}

/**
 * True bila akun berperan sebagai wali kelas: tipe legacy 'wali_kelas', atau
 * guru (type 'user') yang memang wali dari minimal satu kelas (relasi
 * waliKelasId). Dipakai untuk memutuskan kapan aturan kepemilikan wali berlaku
 * — akun guru yang TIDAK merangkap wali tidak menjalankan cek ini.
 */
export async function isWaliKelasAccount(
	user: { type?: string; pegawaiId?: number | null } | null | undefined
): Promise<boolean> {
	if (!user) return false;
	if (user.type === 'wali_kelas') return true;
	if (user.type === 'user' && user.pegawaiId) {
		return (await ownedKelasIdSet(user)).size > 0;
	}
	return false;
}

/**
 * Whether `user` may access `kelasId` in the active `sekolahId`. Mirrors the
 * per-role class scoping in src/routes/+layout.server.ts so API handlers that
 * select the class from the client-controlled active-kelas-id cookie cannot
 * cross class boundaries.
 */
export async function canAccessKelas(
	user: NonNullable<App.Locals['user']> | null | undefined,
	sekolahId: number,
	kelasId: number
): Promise<boolean> {
	if (!user) return false;

	const kelasInSekolah = await db.query.tableKelas.findFirst({
		columns: { id: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelasInSekolah) return false;

	if (isAdminUser(user)) return true;

	if (user.type === 'wali_kelas') {
		// Own class, fallback to user.kelasId (layout: ownIds = ownKelasIds.length > 0 ? ownKelasIds : [user.kelasId]).
		if (user.pegawaiId) {
			const own = await db.query.tableKelas.findFirst({
				columns: { id: true },
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, user.pegawaiId))
			});
			if (own) return true;
		} else if (user.kelasId && user.kelasId === kelasId) {
			return true;
		}
		// Kelas lintas only with kelas_pindah permission (mirror verifyWaliKelasAccess
		// in +layout.server.ts: cookie-selected kelas is nulled for wali_kelas otherwise).
		const hasPindah = Array.isArray(user.permissions) && user.permissions.includes('kelas_pindah');
		if (!hasPindah) return false;
		return !!(await db.query.tableAuthUserKelas.findFirst({
			columns: { id: true },
			where: and(
				eq(tableAuthUserKelas.authUserId, user.id),
				eq(tableAuthUserKelas.kelasId, kelasId)
			)
		}));
	}

	if (user.type === 'wali_asuh') {
		if (!user.pegawaiId) return false;
		const peg = await db.query.tablePegawai.findFirst({
			columns: { nama: true },
			where: eq(tablePegawai.id, user.pegawaiId)
		});
		if (!peg?.nama) return false;
		const namaLower = peg.nama.trim().toLowerCase();
		const rows = await db
			.selectDistinct({ kelasId: tableMurid.kelasId })
			.from(tableMurid)
			.where(
				and(
					sql`LOWER(trim(${tableMurid.waliAsuhNama})) = ${namaLower}`,
					eq(tableMurid.kelasId, kelasId)
				)
			);
		return rows.length > 0;
	}

	if (user.type === 'user') {
		// 0. Status wali kelas via relasi waliKelasId (guru merangkap wali kelas).
		if (user.pegawaiId) {
			const own = await db.query.tableKelas.findFirst({
				columns: { id: true },
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, user.pegawaiId))
			});
			if (own) return true;
		}
		// 1. Cek langsung di auth_user_kelas
		const hasExplicit = await db.query.tableAuthUserKelas.findFirst({
			columns: { id: true },
			where: and(
				eq(tableAuthUserKelas.authUserId, user.id),
				eq(tableAuthUserKelas.kelasId, kelasId)
			)
		});
		if (hasExplicit) return true;

		// 2. Cek kolom legacy kelasId pada auth_user
		if (user.kelasId && user.kelasId === kelasId) return true;

		// 3. Jika user tidak memiliki pembatasan auth_user_kelas, izinkan akses ke kelas dalam sekolah yang sama
		const totalAssignedKelas = await db.query.tableAuthUserKelas.findMany({
			columns: { id: true },
			where: eq(tableAuthUserKelas.authUserId, user.id),
			limit: 1
		});
		if (totalAssignedKelas.length === 0) return true;
	}

	return false;
}

export type KelasLite = { id: number; nama: string; fase: string | null };

/**
 * Set kelas yang DIAMPU guru (bukan kelas wali): kelas dari mapel yang
 * di-assign ke akun (auth_user_mata_pelajaran + legacy kolom) dan mapel yang
 * diampu pegawai (mata_pelajaran.pengampu_id), dibatasi sekolah. Kelas wali
 * TIDAK ikut di sini — gabungkan sendiri dengan ownedKelasIdSet bila perlu.
 */
export async function kelasDiampuSet(
	user:
		| {
				id?: number;
				type?: string;
				pegawaiId?: number | null;
				mataPelajaranId?: number | null;
		  }
		| null
		| undefined,
	sekolahId: number,
	semesterId: number | null = null
): Promise<Set<number>> {
	if (!user || sekolahId <= 0) return new Set();

	const mapelIds = new Set<number>();
	if (user.mataPelajaranId) mapelIds.add(user.mataPelajaranId);
	if (user.id) {
		const assigned = await db.query.tableAuthUserMataPelajaran.findMany({
			columns: { mataPelajaranId: true },
			where: eq(tableAuthUserMataPelajaran.authUserId, user.id)
		});
		for (const row of assigned) mapelIds.add(row.mataPelajaranId);
	}

	const kelasIdRows = new Set<number>();
	const kelasSekolahFilter = semesterId
		? and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, semesterId))
		: eq(tableKelas.sekolahId, sekolahId);
	const orConditions = [];
	if (user.pegawaiId) orConditions.push(eq(tableMataPelajaran.pengampuId, user.pegawaiId));
	if (mapelIds.size) orConditions.push(inArray(tableMataPelajaran.id, [...mapelIds]));
	if (orConditions.length) {
		const rows = await db
			.select({ kelasId: tableMataPelajaran.kelasId })
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableKelas.id, tableMataPelajaran.kelasId))
			.where(and(kelasSekolahFilter, or(...orConditions)));
		for (const row of rows) kelasIdRows.add(row.kelasId);
	}
	return kelasIdRows;
}

/**
 * Gabungan kelas wali + kelas yang diampu. Dipakai pemilih kelas per halaman:
 * guru mapel tidak perlu "pindah kelas" global hanya untuk menilai kelas lain.
 */
export async function kelasKontenSet(
	user:
		| {
				id?: number;
				type?: string;
				pegawaiId?: number | null;
				mataPelajaranId?: number | null;
		  }
		| null
		| undefined,
	sekolahId: number,
	semesterId: number | null = null
): Promise<Set<number>> {
	const hasil = await kelasDiampuSet(user, sekolahId, semesterId);
	if (user?.pegawaiId) {
		const ownFilter = semesterId
			? and(
					eq(tableKelas.sekolahId, sekolahId),
					eq(tableKelas.semesterId, semesterId),
					eq(tableKelas.waliKelasId, user.pegawaiId)
				)
			: and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.waliKelasId, user.pegawaiId));
		const ownRows = await db.query.tableKelas.findMany({
			columns: { id: true },
			where: ownFilter
		});
		for (const row of ownRows) hasil.add(row.id);
	}
	return hasil;
}

/**
 * Resolusi "kelas konten" per halaman via `?kelas=` query param, TANPA
 * menyentuh kelasAktif global (cookie). Aturan:
 * - Tanpa param valid → kelasAktif (perilaku lama).
 * - Admin/kepala sekolah → kelas mana pun dalam sekolah.
 * - Guru ('user'/'wali_kelas') → hanya kelas wali ∪ kelas diampu.
 * - Wali asuh → tetap kelasAktif (kategori tidak relevan saat ini).
 */
export async function resolveKelasKonten(
	user: NonNullable<App.Locals['user']> | null | undefined,
	sekolahId: number,
	kelasParam: number | null,
	kelasAktif: KelasLite | null,
	semesterId: number | null = null
): Promise<KelasLite | null> {
	if (!kelasParam || !Number.isInteger(kelasParam) || kelasParam <= 0) return kelasAktif;
	if (kelasAktif?.id === kelasParam) return kelasAktif;

	const kelasFilter = semesterId
		? and(
				eq(tableKelas.id, kelasParam),
				eq(tableKelas.sekolahId, sekolahId),
				eq(tableKelas.semesterId, semesterId)
			)
		: and(eq(tableKelas.id, kelasParam), eq(tableKelas.sekolahId, sekolahId));
	const kelas = await db.query.tableKelas.findFirst({
		columns: { id: true, nama: true, fase: true },
		where: kelasFilter
	});
	if (!kelas) return kelasAktif ?? null;

	if (isAdminUser(user)) return kelas;
	if (!user) return kelasAktif ?? null;

	if (user.type !== 'user' && user.type !== 'wali_kelas') return kelasAktif ?? null;

	const diizinkan = await kelasKontenSet(user, sekolahId, semesterId);
	if (diizinkan.has(kelas.id)) return kelas;

	return kelasAktif ?? null;
}
