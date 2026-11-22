import db from '$lib/server/db';
import {
	tableAuthSession,
	tableAuthUser,
	tableKelas,
	tablePegawai,
	tableSekolah
} from '$lib/server/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';

/**
 * Shared helpers for merging duplicate person records / auth accounts.
 *
 * Use case: a PLT kepala sekolah must keep teaching hours, so the same person
 * is also a wali kelas / guru mapel. The sekolah form and the kelas form each
 * store their own `pegawai` row and each receives its own auth account
 * (`kepala_sekolah` + `wali_kelas`), producing two accounts with the same name
 * in `/pengguna` and duplicate rows in attendance.
 *
 * Strategy: keep a single pegawai + a single `kepala_sekolah` account (the role
 * with the widest access). Other guru accounts for the same person are merged
 * (presensi + sessions are moved) and deleted.
 */

export type GuruPegawaiRef = { id: number; nama: string; nip: string | null };

/**
 * Find an existing guru pegawai (wali kelas or guru mapel) attached to a sekolah
 * that matches the kepala sekolah identity. NIP match is preferred (when the
 * candidate has the same non-empty NIP), then a case-insensitive exact name
 * match. The `excludePegawaiId` pegawai (the current kepala sekolah record) is
 * skipped so we never return the record we are trying to replace.
 */
export async function findGuruPegawaiForKepalaSekolah(
	sekolahId: number,
	excludePegawaiId: number | null,
	nama: string,
	nip?: string | null
): Promise<GuruPegawaiRef | null> {
	const trimmedNama = (nama ?? '').trim();
	if (!trimmedNama) return null;

	const waliPegawai = await db
		.selectDistinct({
			id: tablePegawai.id,
			nama: tablePegawai.nama,
			nip: tablePegawai.nip
		})
		.from(tablePegawai)
		.innerJoin(tableKelas, eq(tableKelas.waliKelasId, tablePegawai.id))
		.where(eq(tableKelas.sekolahId, sekolahId));

	const guruAuthPegawai = await db
		.selectDistinct({
			id: tablePegawai.id,
			nama: tablePegawai.nama,
			nip: tablePegawai.nip
		})
		.from(tablePegawai)
		.innerJoin(tableAuthUser, eq(tableAuthUser.pegawaiId, tablePegawai.id))
		.where(
			and(
				eq(tableAuthUser.sekolahId, sekolahId),
				inArray(tableAuthUser.type, ['user', 'wali_kelas'])
			)
		);

	const candidates = new Map<number, GuruPegawaiRef>();
	for (const p of [...waliPegawai, ...guruAuthPegawai]) {
		if (excludePegawaiId != null && p.id === excludePegawaiId) continue;
		candidates.set(p.id, p);
	}
	if (!candidates.size) return null;

	const nipKey = (nip ?? '').trim().toLowerCase();
	if (nipKey) {
		for (const p of candidates.values()) {
			if ((p.nip ?? '').trim().toLowerCase() === nipKey) return p;
		}
	}

	const namaKey = trimmedNama.toLowerCase();
	// Name match is a fallback when NIPs don't discriminate. Only auto-match
	// when exactly one candidate shares the name; several same-name teachers is
	// too ambiguous to repoint silently.
	const nameMatches = [...candidates.values()].filter(
		(p) => p.nama.trim().toLowerCase() === namaKey
	);
	return nameMatches.length === 1 ? nameMatches[0] : null;
}

/** Repoint active sessions from one account to another (best-effort). */
export async function migrateSessions(fromUserId: number, toUserId: number): Promise<void> {
	if (fromUserId === toUserId) return;
	try {
		await db
			.update(tableAuthSession)
			.set({ userId: toUserId })
			.where(eq(tableAuthSession.userId, fromUserId));
	} catch (err) {
		console.warn('[pengguna-merge] Failed to migrate sessions:', err);
	}
}

/**
 * Merge `deleteUserId` into `keepUserId`: move sessions, then remove
 * the deleted account.
 */
export async function mergeAccountInto(keepUserId: number, deleteUserId: number): Promise<void> {
	if (keepUserId === deleteUserId) return;
	console.info(`[pengguna-merge] Merging account ${deleteUserId} into ${keepUserId}`);
	await migrateSessions(deleteUserId, keepUserId);
	await db.delete(tableAuthUser).where(eq(tableAuthUser.id, deleteUserId));
}

/**
 * Delete a pegawai record only when nothing references it anymore (no kelas
 * wali/asuh, no auth account, no sekolah kepala sekolah). Returns whether
 * the record was deleted.
 */
export async function deletePegawaiIfOrphaned(pegawaiId: number): Promise<boolean> {
	const [kelasWaliRef, kelasAsuhRef, authRef, sekolahRef] = await Promise.all([
		db.query.tableKelas.findFirst({
			columns: { id: true },
			where: eq(tableKelas.waliKelasId, pegawaiId)
		}),
		db.query.tableKelas.findFirst({
			columns: { id: true },
			where: eq(tableKelas.waliAsuhId, pegawaiId)
		}),
		db.query.tableAuthUser.findFirst({
			columns: { id: true },
			where: eq(tableAuthUser.pegawaiId, pegawaiId)
		}),
		db.query.tableSekolah.findFirst({
			columns: { id: true },
			where: eq(tableSekolah.kepalaSekolahId, pegawaiId)
		})
	]);
	if (kelasWaliRef || kelasAsuhRef || authRef || sekolahRef) return false;
	await db.delete(tablePegawai).where(eq(tablePegawai.id, pegawaiId));
	return true;
}

const GURU_TYPES_TO_MERGE: Array<AuthUser['type']> = ['wali_kelas', 'user'];

/**
 * Arahkan referensi pegawai (wali kelas, wali asuh, kepala sekolah) dari satu
 * record ke record lain supaya record lama bisa dihapus.
 *
 * Hanya baris milik `sekolahId` yang dipindah supaya deployment multi-sekolah
 * tidak ikut berubah.
 */
export async function repointPegawaiReferences(
	fromPegawaiId: number,
	toPegawaiId: number,
	sekolahId: number
): Promise<void> {
	if (fromPegawaiId === toPegawaiId) return;
	await db
		.update(tableKelas)
		.set({ waliKelasId: toPegawaiId })
		.where(and(eq(tableKelas.waliKelasId, fromPegawaiId), eq(tableKelas.sekolahId, sekolahId)));
	await db
		.update(tableKelas)
		.set({ waliAsuhId: toPegawaiId })
		.where(and(eq(tableKelas.waliAsuhId, fromPegawaiId), eq(tableKelas.sekolahId, sekolahId)));
	await db
		.update(tableSekolah)
		.set({ kepalaSekolahId: toPegawaiId })
		.where(and(eq(tableSekolah.kepalaSekolahId, fromPegawaiId), eq(tableSekolah.id, sekolahId)));
}

/**
 * Global sweep: for every pegawai that owns a `kepala_sekolah` account plus
 * other guru accounts (`wali_kelas` / `user`), keep the kepala_sekolah account
 * and merge the rest. The merge target prefers a kepala_sekolah account scoped
 * to the same sekolah as the account being merged (multi-sekolah safety).
 */
export async function mergeAccountsUnderKepalaSekolah(): Promise<void> {
	const accounts = await db.query.tableAuthUser.findMany({
		columns: { id: true, pegawaiId: true, type: true, sekolahId: true, createdAt: true },
		where: ne(tableAuthUser.type, 'admin')
	});

	const byPegawai = new Map<
		number,
		Array<{ id: number; type: string; sekolahId: number | null; createdAt: string | null }>
	>();
	for (const a of accounts) {
		if (!a.pegawaiId) continue;
		const arr = byPegawai.get(a.pegawaiId) ?? [];
		arr.push(a);
		byPegawai.set(a.pegawaiId, arr);
	}

	for (const [, arr] of byPegawai) {
		const kepala = arr.filter((a) => a.type === 'kepala_sekolah');
		if (!kepala.length) continue;
		const others = arr.filter(
			(a) => a.type !== 'kepala_sekolah' && GURU_TYPES_TO_MERGE.includes(a.type as AuthUser['type'])
		);
		if (!others.length) continue;

		const byCreated = (list: typeof arr) =>
			[...list].sort(
				(a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
			);
		const sortedKepala = byCreated(kepala);

		for (const o of others) {
			// Only merge guru accounts that belong to the same sekolah as a kept
			// kepala account. A wali_kelas/user account in another sekolah (same
			// person, multi-sekolah deployment) must not be deleted.
			const keep = sortedKepala.find((k) => k.sekolahId === o.sekolahId);
			if (!keep) continue;
			await mergeAccountInto(keep.id, o.id);
		}
	}
}
