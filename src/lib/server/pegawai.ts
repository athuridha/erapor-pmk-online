import { and, eq, inArray, ne } from 'drizzle-orm';
import db from './db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableKelas,
	tableMataPelajaran
} from './db/schema';

export type GuruSekolah = {
	id: number;
	nama: string;
	statusKepegawaian: string | null;
	golongan: string | null;
};

/**
 * All "guru" (non-admin, non-wali_asuh) accounts belonging to a sekolah.
 * kepala_sekolah accounts are included so their own presence is tracked and
 * shows in tables/reports. Membership resolves via auth_user.sekolahId,
 * auth_user.kelasId, auth_user_kelas, or auth_user_mata_pelajaran (-> mapel -> kelas).
 */
export async function listGuruBySekolah(sekolahId: number): Promise<GuruSekolah[]> {
	const users = await db.query.tableAuthUser.findMany({
		columns: {
			id: true,
			username: true,
			namaLengkap: true,
			type: true,
			sekolahId: true,
			kelasId: true,
			statusKepegawaian: true,
			golongan: true
		},
		with: { pegawai: { columns: { nama: true } } },
		where: and(
			ne(tableAuthUser.type, 'admin'),
			ne(tableAuthUser.type, 'wali_asuh'),
			ne(tableAuthUser.type, 'pembina_eskul')
		)
	});

	const kelasRows = await db.query.tableKelas.findMany({
		columns: { id: true },
		where: eq(tableKelas.sekolahId, sekolahId)
	});
	const kelasIds = new Set(kelasRows.map((k) => k.id));

	let usersByKelasLink = new Set<number>();
	let usersByMapelLink = new Set<number>();
	if (kelasIds.size) {
		const kelasLinkRows = await db.query.tableAuthUserKelas.findMany({
			columns: { authUserId: true },
			where: inArray(tableAuthUserKelas.kelasId, [...kelasIds])
		});
		usersByKelasLink = new Set(kelasLinkRows.map((r) => r.authUserId));

		const mapelRows = await db.query.tableMataPelajaran.findMany({
			columns: { id: true },
			where: inArray(tableMataPelajaran.kelasId, [...kelasIds])
		});
		const mapelIds = mapelRows.map((m) => m.id);
		if (mapelIds.length) {
			// D1 menolak query dengan >100 parameter; mapel satu sekolah bisa ratusan.
			const mapelLinkRows: Array<{ authUserId: number }> = [];
			for (let i = 0; i < mapelIds.length; i += 100) {
				const chunk = mapelIds.slice(i, i + 100);
				mapelLinkRows.push(
					...(await db.query.tableAuthUserMataPelajaran.findMany({
						columns: { authUserId: true },
						where: inArray(tableAuthUserMataPelajaran.mataPelajaranId, chunk)
					}))
				);
			}
			usersByMapelLink = new Set(mapelLinkRows.map((r) => r.authUserId));
		}
	}

	const result: GuruSekolah[] = [];
	const byName = new Map<string, GuruSekolah & { type: string }>();
	const rank = (t: string) =>
		t === 'kepala_sekolah' ? 3 : t === 'wali_kelas' ? 2 : t === 'user' ? 1 : 0;
	for (const u of users) {
		const inSchool =
			u.sekolahId === sekolahId ||
			(u.kelasId != null && kelasIds.has(u.kelasId)) ||
			usersByKelasLink.has(u.id) ||
			usersByMapelLink.has(u.id);
		if (!inSchool) continue;
		const nama = (u.namaLengkap ?? u.pegawai?.nama ?? u.username ?? '').trim();
		if (!nama) continue;
		const key = nama.toLowerCase();
		const candidate: GuruSekolah & { type: string } = {
			id: u.id,
			nama,
			statusKepegawaian: u.statusKepegawaian ?? null,
			golongan: u.golongan ?? null,
			type: u.type ?? ''
		};
		// Safety net: if the same person still has several accounts (legacy data),
		// keep only the most privileged one so they don't appear twice / presensi twice.
		const existing = byName.get(key);
		if (!existing || rank(candidate.type) > rank(existing.type)) {
			byName.set(key, candidate);
		}
	}
	for (const g of byName.values()) {
		result.push({
			id: g.id,
			nama: g.nama,
			statusKepegawaian: g.statusKepegawaian,
			golongan: g.golongan
		});
	}
	result.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
	return result;
}
