import { and, eq, sql } from 'drizzle-orm';
import db from './db';
import { tableAuthUserKelas, tableKelas, tableMurid, tablePegawai } from './db/schema';

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

	if (user.type === 'admin' || user.type === 'kepala_sekolah') return true;

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
