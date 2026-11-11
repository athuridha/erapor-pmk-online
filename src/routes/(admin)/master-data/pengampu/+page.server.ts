import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableKelas,
	tableMataPelajaran,
	tablePegawai
} from '$lib/server/db/schema';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { isAdminUser } from '../../../pengguna/permissions';
import { agamaVariantNames, pksVariantNames } from '$lib/statics';
import { chunk, queryInChunks, runInChunks } from '$lib/server/db/chunk';
import type { Actions, PageServerLoad } from './$types';

/**
 * Model mapel agama disatukan: varian agama/PKS (PAI, PAK, dst.) dipakai
 * internal per agama murid dan sudah disembunyikan di /intrakurikuler, maka
 * di matriks pengampu pun hanya mapel induk (PAPB/PKS) yang ditampilkan.
 * Tanpa ini matriks berisi 23 baris/kelas (460) sementara tampilan guru 17
 * baris/kelas — angka antanhalaman tidak pernah cocok.
 */
const MAPEL_VARIAN_SET = new Set<string>([...agamaVariantNames, ...pksVariantNames]);

/**
 * `auth_user_mata_pelajaran` / `auth_user_kelas` diisi 4 nilai per baris
 * (user, mapel/kelas, createdAt, updatedAt). D1 menolak >100 bound parameter,
 * jadi maksimal 20 baris per statement (80 parameter).
 */
const AUTH_INSERT_CHUNK = 20;

type MapelSekolahRow = {
	id: number;
	nama: string;
	kelasId: number;
	pengampuId: number | null;
};

/** Satu baris mapel yang pengampunya berubah. */
type PengampuChange = {
	id: number;
	kelasId: number;
	/** Guru pengampu sebelumnya (null = belum ada). */
	pengampuId: number | null;
	/** Guru pengampu setelah perubahan (null = dikosongkan). */
	nextPengampuId: number | null;
};

function uniqueInts(values: FormDataEntryValue[]): number[] {
	const ids = new Set<number>();
	for (const value of values) {
		const n = Number(value);
		if (Number.isInteger(n) && n > 0) ids.add(n);
	}
	return Array.from(ids);
}

function integerParam(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function checkboxParam(value: FormDataEntryValue | null): boolean {
	return value === 'on' || value === '1' || value === 'true';
}

async function loadMapelSekolah(sekolahId: number): Promise<MapelSekolahRow[]> {
	return db
		.select({
			id: tableMataPelajaran.id,
			nama: tableMataPelajaran.nama,
			kelasId: tableMataPelajaran.kelasId,
			pengampuId: tableMataPelajaran.pengampuId
		})
		.from(tableMataPelajaran)
		.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
		.where(eq(tableKelas.sekolahId, sekolahId));
}

/** Akun login (auth_user) untuk daftar pegawai, dipecah agar aman di D1. */
async function loadAuthUserByPegawai(sekolahId: number, pegawaiIds: number[]) {
	const map = new Map<number, number>();
	if (!pegawaiIds.length) return map;

	const rows = await queryInChunks(pegawaiIds, (ids) =>
		db
			.select({ id: tableAuthUser.id, pegawaiId: tableAuthUser.pegawaiId })
			.from(tableAuthUser)
			.where(and(eq(tableAuthUser.sekolahId, sekolahId), inArray(tableAuthUser.pegawaiId, ids)))
	);
	for (const row of rows) {
		if (row.pegawaiId && !map.has(row.pegawaiId)) map.set(row.pegawaiId, row.id);
	}
	return map;
}

/**
 * Terapkan perubahan guru pengampu sekaligus: update kolom `pengampu_id` lalu
 * sinkronkan izin akun guru (tambah untuk guru baru, cabut untuk guru lama).
 * Semua query `inArray` dipecah supaya tidak menabrak batas parameter D1.
 */
async function applyPengampuChanges(
	sekolahId: number,
	changes: PengampuChange[],
	now: string
): Promise<void> {
	if (!changes.length) return;

	// 1) Update kolom pengampu, dikelompokkan per guru tujuan.
	const byTarget = new Map<number | null, PengampuChange[]>();
	for (const change of changes) {
		const list = byTarget.get(change.nextPengampuId) ?? [];
		list.push(change);
		byTarget.set(change.nextPengampuId, list);
	}
	for (const [targetId, list] of byTarget) {
		await runInChunks(
			list.map((change) => change.id),
			(ids) =>
				db
					.update(tableMataPelajaran)
					.set({ pengampuId: targetId, updatedAt: now })
					.where(inArray(tableMataPelajaran.id, ids))
		);
	}

	// 2) Akun login semua guru yang terlibat.
	const pegawaiIds = new Set<number>();
	for (const change of changes) {
		if (change.nextPengampuId) pegawaiIds.add(change.nextPengampuId);
		if (change.pengampuId) pegawaiIds.add(change.pengampuId);
	}
	const authUserByPegawai = await loadAuthUserByPegawai(sekolahId, Array.from(pegawaiIds));

	// 3) Beri izin mapel/kelas ke guru baru.
	for (const [targetId, list] of byTarget) {
		if (!targetId) continue;
		const authUserId = authUserByPegawai.get(targetId);
		if (!authUserId) continue;

		for (const part of chunk(list, AUTH_INSERT_CHUNK)) {
			await db
				.insert(tableAuthUserMataPelajaran)
				.values(
					part.map((change) => ({
						authUserId,
						mataPelajaranId: change.id,
						createdAt: now,
						updatedAt: now
					}))
				)
				.onConflictDoNothing();
		}

		const kelasIds = Array.from(new Set(list.map((change) => change.kelasId)));
		for (const part of chunk(kelasIds, AUTH_INSERT_CHUNK)) {
			await db
				.insert(tableAuthUserKelas)
				.values(part.map((kelasId) => ({ authUserId, kelasId, createdAt: now, updatedAt: now })))
				.onConflictDoNothing();
		}
	}

	// 4) Cabut izin mapel dari guru lama yang diganti.
	const revokeByPegawai = new Map<number, number[]>();
	for (const change of changes) {
		if (!change.pengampuId || change.pengampuId === change.nextPengampuId) continue;
		const list = revokeByPegawai.get(change.pengampuId) ?? [];
		list.push(change.id);
		revokeByPegawai.set(change.pengampuId, list);
	}
	for (const [pegawaiId, mapelIds] of revokeByPegawai) {
		const authUserId = authUserByPegawai.get(pegawaiId);
		if (!authUserId) continue;
		await runInChunks(mapelIds, (ids) =>
			db
				.delete(tableAuthUserMataPelajaran)
				.where(
					and(
						eq(tableAuthUserMataPelajaran.authUserId, authUserId),
						inArray(tableAuthUserMataPelajaran.mataPelajaranId, ids)
					)
				)
		);
	}
}

/** Pastikan guru target terdaftar di sekolah aktif. */
async function loadGuruSekolah(sekolahId: number, pegawaiIds: number[]) {
	const rows = await queryInChunks(pegawaiIds, (ids) =>
		db.query.tablePegawai.findMany({
			columns: { id: true, nama: true },
			where: and(eq(tablePegawai.sekolahId, sekolahId), inArray(tablePegawai.id, ids))
		})
	);
	const map = new Map<number, { id: number; nama: string }>();
	for (const row of rows) map.set(row.id, row);
	return map;
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:master-data-pengampu');
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || !isAdminUser(user)) {
		throw error(403, 'Guru pengampu hanya bisa dikelola admin dan kepala sekolah.');
	}

	const [daftarKelas, daftarGuru] = await Promise.all([
		db.query.tableKelas.findMany({
			where: eq(tableKelas.sekolahId, sekolahId),
			columns: { id: true, nama: true, fase: true },
			orderBy: (k, { asc }) => [asc(k.nama)]
		}),
		db.query.tablePegawai.findMany({
			where: and(eq(tablePegawai.sekolahId, sekolahId), ne(tablePegawai.nama, '-')),
			columns: { id: true, nama: true, nip: true, nik: true },
			orderBy: (p, { asc }) => [asc(p.nama)]
		})
	]);

	const allMapelRows = (
		await db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kode: tableMataPelajaran.kode,
				jenis: tableMataPelajaran.jenis,
				kategori: tableMataPelajaran.kategori,
				kkm: tableMataPelajaran.kkm,
				urutan: tableMataPelajaran.urutan,
				kelasId: tableMataPelajaran.kelasId,
				kelasNama: tableKelas.nama,
				fase: tableKelas.fase,
				pengampuId: tableMataPelajaran.pengampuId,
				pengampuNama: tablePegawai.nama
			})
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
			.leftJoin(tablePegawai, eq(tableMataPelajaran.pengampuId, tablePegawai.id))
			.where(eq(tableKelas.sekolahId, sekolahId))
			.orderBy(
				asc(tableKelas.nama),
				sql`coalesce(${tableMataPelajaran.urutan}, 999)`,
				asc(tableMataPelajaran.nama)
			)
	).filter((row) => !MAPEL_VARIAN_SET.has(row.nama));

	// Distinct mapels di sekolah
	const mapelMap = new Map<
		string,
		{ nama: string; jenis: string | null; kode: string | null; countKelas: number }
	>();
	for (const m of allMapelRows) {
		const existing = mapelMap.get(m.nama);
		if (!existing) {
			mapelMap.set(m.nama, {
				nama: m.nama,
				jenis: m.jenis,
				kode: m.kode,
				countKelas: 1
			});
		} else {
			existing.countKelas += 1;
		}
	}
	const distinctMapels = Array.from(mapelMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));

	// Akun login guru untuk sinkronisasi
	const userAccounts = await db
		.select({
			id: tableAuthUser.id,
			username: tableAuthUser.username,
			pegawaiId: tableAuthUser.pegawaiId
		})
		.from(tableAuthUser)
		.where(eq(tableAuthUser.sekolahId, sekolahId));
	const userByPegawai = new Map(
		userAccounts.filter((u) => u.pegawaiId != null).map((u) => [u.pegawaiId!, u])
	);

	// Rekap per guru
	const guruRekap = daftarGuru.map((guru) => {
		const tugas = allMapelRows.filter((m) => m.pengampuId === guru.id);
		const mapelGroup = new Map<
			string,
			{ mapelNama: string; kelasNames: string[]; jenis: string | null }
		>();
		for (const t of tugas) {
			const existing = mapelGroup.get(t.nama);
			if (!existing) {
				mapelGroup.set(t.nama, { mapelNama: t.nama, kelasNames: [t.kelasNama], jenis: t.jenis });
			} else {
				existing.kelasNames.push(t.kelasNama);
			}
		}
		const akun = userByPegawai.get(guru.id);
		return {
			id: guru.id,
			nama: guru.nama,
			nip: guru.nip,
			nik: guru.nik,
			hasAkun: !!akun,
			username: akun?.username ?? null,
			penugasanList: Array.from(mapelGroup.values()),
			mapelList: Array.from(mapelGroup.keys()),
			kelasList: tugas.map((t) => t.kelasNama),
			totalTugas: tugas.length
		};
	});

	const kelasParam = url.searchParams.get('kelas');
	const selectedKelasId =
		kelasParam === 'semua'
			? 'semua'
			: Number(kelasParam) || (daftarKelas.length > 0 ? daftarKelas[0].id : 'semua');

	const mapelRows =
		selectedKelasId === 'semua'
			? allMapelRows
			: allMapelRows.filter((m) => m.kelasId === Number(selectedKelasId));

	const totalMapel = allMapelRows.length;
	const totalTerisi = allMapelRows.filter((m) => m.pengampuId != null).length;

	return {
		meta: { title: 'Master Data — Guru Pengampu', hideTaskRail: true },
		daftarKelas,
		daftarGuru,
		distinctMapels,
		guruRekap,
		allMapelRows,
		mapelRows,
		selectedKelasId,
		totalMapel,
		totalTerisi
	};
};

export const actions: Actions = {
	simpan: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah guru pengampu.' });
		}

		const formData = await request.formData();
		const mapelIds = uniqueInts(formData.getAll('mapel_id'));
		if (!mapelIds.length) {
			return fail(400, { fail: 'Tidak ada mata pelajaran yang dipilih.' });
		}

		const validMapels = await queryInChunks(mapelIds, (ids) =>
			db
				.select({
					id: tableMataPelajaran.id,
					kelasId: tableMataPelajaran.kelasId,
					pengampuId: tableMataPelajaran.pengampuId
				})
				.from(tableMataPelajaran)
				.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
				.where(and(eq(tableKelas.sekolahId, sekolahId), inArray(tableMataPelajaran.id, ids)))
		);

		const pegawaiIds = new Set(
			(
				await db
					.select({ id: tablePegawai.id })
					.from(tablePegawai)
					.where(eq(tablePegawai.sekolahId, sekolahId))
			).map((p) => p.id)
		);

		const changes: PengampuChange[] = [];
		for (const mapel of validMapels) {
			const raw = formData.get(`pengampu_${mapel.id}`);
			const parsed = raw && String(raw).trim() !== '' ? Number(raw) : null;
			const next = parsed && Number.isInteger(parsed) && pegawaiIds.has(parsed) ? parsed : null;
			if (next !== mapel.pengampuId) {
				changes.push({
					id: mapel.id,
					kelasId: mapel.kelasId,
					pengampuId: mapel.pengampuId,
					nextPengampuId: next
				});
			}
		}

		await applyPengampuChanges(sekolahId, changes, new Date().toISOString());

		return {
			message: `Berhasil memperbarui penugasan guru pengampu (${changes.length} mapel diubah).`
		};
	},

	simpanTugasGuru: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah guru pengampu.' });
		}

		const formData = await request.formData();
		const guruIdRaw = formData.get('guru_id');
		const guruId = guruIdRaw ? Number(guruIdRaw) : null;
		if (!guruId) {
			return fail(400, { fail: 'Guru wajib dipilih.' });
		}

		const guru = await db.query.tablePegawai.findFirst({
			columns: { id: true, nama: true },
			where: and(eq(tablePegawai.id, guruId), eq(tablePegawai.sekolahId, sekolahId))
		});
		if (!guru) {
			return fail(404, { fail: 'Data guru tidak ditemukan di sekolah ini.' });
		}

		const newIdsSet = new Set(uniqueInts(formData.getAll('mapel_ids')));
		const allSchoolMapels = await loadMapelSekolah(sekolahId);
		const schoolMapelMap = new Map(allSchoolMapels.map((m) => [m.id, m]));
		const now = new Date().toISOString();

		const previousIds = new Set(
			allSchoolMapels.filter((m) => m.pengampuId === guruId).map((m) => m.id)
		);
		const finalIds = new Set(Array.from(newIdsSet).filter((id) => schoolMapelMap.has(id)));

		const changes: PengampuChange[] = [];
		for (const mapel of allSchoolMapels) {
			if (previousIds.has(mapel.id) && !finalIds.has(mapel.id)) {
				changes.push({
					id: mapel.id,
					kelasId: mapel.kelasId,
					pengampuId: mapel.pengampuId,
					nextPengampuId: null
				});
			} else if (!previousIds.has(mapel.id) && finalIds.has(mapel.id)) {
				changes.push({
					id: mapel.id,
					kelasId: mapel.kelasId,
					pengampuId: mapel.pengampuId,
					nextPengampuId: guruId
				});
			}
		}

		await applyPengampuChanges(sekolahId, changes, now);

		const finalAssigned = Array.from(finalIds).map((id) => schoolMapelMap.get(id)!);
		const distinctMapelNames = new Set(finalAssigned.map((m) => m.nama));

		return {
			message: `Tugas mengajar untuk ${guru.nama} berhasil disimpan (${distinctMapelNames.size} mapel, ${finalAssigned.length} rombel).`
		};
	},

	tugaskanSekaligus: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah guru pengampu.' });
		}

		const formData = await request.formData();
		const mapelNama = String(formData.get('mapel_nama') || '').trim();
		const guruIdRaw = formData.get('guru_id');
		const guruId = guruIdRaw && String(guruIdRaw).trim() !== '' ? Number(guruIdRaw) : null;
		const kelasIds = uniqueInts(formData.getAll('kelas_ids'));
		const aksi = String(formData.get('aksi') || 'set');

		if (!mapelNama) {
			return fail(400, { fail: 'Mata pelajaran wajib dipilih.' });
		}
		if (kelasIds.length === 0) {
			return fail(400, { fail: 'Pilih minimal satu kelas / rombel.' });
		}

		const targetPengampuId = aksi === 'hapus' ? null : guruId;
		if (aksi !== 'hapus' && !targetPengampuId) {
			return fail(400, { fail: 'Guru pengampu wajib dipilih.' });
		}

		// Ambil mapel yang cocok di kelas-kelas tersebut
		const targetMapels = await db
			.select({
				id: tableMataPelajaran.id,
				kelasId: tableMataPelajaran.kelasId,
				pengampuId: tableMataPelajaran.pengampuId
			})
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
			.where(
				and(
					eq(tableKelas.sekolahId, sekolahId),
					eq(tableMataPelajaran.nama, mapelNama),
					inArray(tableMataPelajaran.kelasId, kelasIds)
				)
			);

		if (targetMapels.length === 0) {
			return fail(404, {
				fail: `Mata pelajaran "${mapelNama}" tidak ditemukan di kelas yang dipilih.`
			});
		}

		const now = new Date().toISOString();
		const changes: PengampuChange[] = targetMapels
			.filter((mapel) => mapel.pengampuId !== targetPengampuId)
			.map((mapel) => ({
				id: mapel.id,
				kelasId: mapel.kelasId,
				pengampuId: mapel.pengampuId,
				nextPengampuId: targetPengampuId
			}));

		await applyPengampuChanges(sekolahId, changes, now);

		return {
			message: targetPengampuId
				? `Berhasil menugaskan guru untuk mapel "${mapelNama}" di ${targetMapels.length} kelas.`
				: `Berhasil mengosongkan guru pengampu mapel "${mapelNama}" di ${targetMapels.length} kelas.`
		};
	},

	bulkAssign: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah guru pengampu.' });
		}

		const formData = await request.formData();
		const mapelIds = uniqueInts(formData.getAll('mapel_ids'));
		const targetPengampuId = integerParam(formData.get('guru_id'));

		if (mapelIds.length === 0) {
			return fail(400, { fail: 'Pilih minimal satu mata pelajaran.' });
		}

		// Validasi guru tujuan milik sekolah aktif (id kosong = kosongkan pengampu).
		let targetNama: string | null = null;
		if (targetPengampuId) {
			const guru = (await loadGuruSekolah(sekolahId, [targetPengampuId])).get(targetPengampuId);
			if (!guru) {
				return fail(404, { fail: 'Guru pengampu tidak ditemukan di sekolah ini.' });
			}
			targetNama = guru.nama;
		}

		const targetMapels = await queryInChunks(mapelIds, (ids) =>
			db
				.select({
					id: tableMataPelajaran.id,
					kelasId: tableMataPelajaran.kelasId,
					pengampuId: tableMataPelajaran.pengampuId
				})
				.from(tableMataPelajaran)
				.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
				.where(and(eq(tableKelas.sekolahId, sekolahId), inArray(tableMataPelajaran.id, ids)))
		);

		if (targetMapels.length === 0) {
			return fail(404, { fail: 'Mata pelajaran tidak ditemukan.' });
		}

		const now = new Date().toISOString();
		const changes: PengampuChange[] = targetMapels
			.filter((mapel) => mapel.pengampuId !== targetPengampuId)
			.map((mapel) => ({
				id: mapel.id,
				kelasId: mapel.kelasId,
				pengampuId: mapel.pengampuId,
				nextPengampuId: targetPengampuId
			}));

		await applyPengampuChanges(sekolahId, changes, now);

		const dilewati = targetMapels.length - changes.length;
		const sisa = dilewati ? `, ${dilewati} sudah sesuai` : '';
		return {
			message: targetPengampuId
				? `Berhasil menugaskan ${targetNama} ke ${changes.length} mata pelajaran terpilih${sisa}.`
				: `Berhasil mengosongkan guru pengampu pada ${changes.length} mata pelajaran terpilih${sisa}.`
		};
	},

	/**
	 * Salin penugasan dari guru lain: semua mapel yang diampu guru sumber
	 * ditugaskan ke guru target pada kelas terpilih (default semua kelas).
	 * Baris yang sudah diampu guru lain TIDAK ditimpa diam-diam — dilewati dan
	 * dilaporkan jumlahnya, kecuali admin mencentang "timpa".
	 */
	salinPenugasan: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa mengubah guru pengampu.' });
		}

		const formData = await request.formData();
		const sumberId = integerParam(formData.get('guru_sumber'));
		const targetId = integerParam(formData.get('guru_target'));
		if (!sumberId || !targetId) {
			return fail(400, { fail: 'Guru sumber dan guru target wajib dipilih.' });
		}
		if (sumberId === targetId) {
			return fail(400, { fail: 'Guru sumber dan guru target tidak boleh sama.' });
		}

		const guruMap = await loadGuruSekolah(sekolahId, [sumberId, targetId]);
		const sumber = guruMap.get(sumberId);
		const target = guruMap.get(targetId);
		if (!sumber) return fail(404, { fail: 'Guru sumber tidak ditemukan di sekolah ini.' });
		if (!target) return fail(404, { fail: 'Guru target tidak ditemukan di sekolah ini.' });

		const scopeKelasIds = uniqueInts(formData.getAll('kelas_ids'));
		const timpa = checkboxParam(formData.get('timpa'));
		const allMapels = await loadMapelSekolah(sekolahId);

		const sumberRows = allMapels.filter((m) => m.pengampuId === sumberId);
		if (!sumberRows.length) {
			return fail(404, {
				fail: `${sumber.nama} belum punya penugasan mapel yang bisa disalin.`
			});
		}
		const namaSumber = new Set(sumberRows.map((m) => m.nama));
		const candidates = allMapels.filter(
			(m) =>
				namaSumber.has(m.nama) && (scopeKelasIds.length === 0 || scopeKelasIds.includes(m.kelasId))
		);

		const changes: PengampuChange[] = [];
		let dialihkan = 0; // dari guru sumber
		let diisi = 0; // rombel yang sebelumnya kosong
		let ditimpa = 0; // milik guru lain lalu ditimpa
		let dilewati = 0; // milik guru lain, dibiarkan
		let sudahTarget = 0; // memang sudah diampu target

		for (const row of candidates) {
			if (row.pengampuId === targetId) {
				sudahTarget += 1;
				continue;
			}
			const change: PengampuChange = {
				id: row.id,
				kelasId: row.kelasId,
				pengampuId: row.pengampuId,
				nextPengampuId: targetId
			};
			if (row.pengampuId === sumberId) {
				changes.push(change);
				dialihkan += 1;
			} else if (row.pengampuId == null) {
				changes.push(change);
				diisi += 1;
			} else if (timpa) {
				changes.push(change);
				ditimpa += 1;
			} else {
				dilewati += 1;
			}
		}

		if (!changes.length) {
			const alasan = [
				dilewati ? `${dilewati} baris sudah diampu guru lain` : '',
				sudahTarget ? `${sudahTarget} baris sudah diampu ${target.nama}` : ''
			]
				.filter(Boolean)
				.join(', ');
			return {
				message: `Tidak ada penugasan yang disalin${alasan ? ` (${alasan})` : ''}.`
			};
		}

		await applyPengampuChanges(sekolahId, changes, new Date().toISOString());

		const rincian = [
			`${dialihkan} penugasan dialihkan dari ${sumber.nama}`,
			diisi ? `${diisi} rombel kosong diisi` : '',
			ditimpa ? `${ditimpa} penugasan guru lain ditimpa` : '',
			dilewati ? `${dilewati} dilewati karena sudah diampu guru lain` : '',
			sudahTarget ? `${sudahTarget} sudah diampu target` : ''
		].filter(Boolean);

		const sisaSumber = sumberRows.length - dialihkan;
		return {
			message: `Penugasan ${sumber.nama} → ${target.nama}: ${changes.length} baris (${rincian.join(', ')}).${
				sisaSumber > 0
					? ` ${sumber.nama} masih mengampu ${sisaSumber} penugasan di luar cakupan.`
					: ''
			}`
		};
	}
};
