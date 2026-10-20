import { and, eq, inArray } from 'drizzle-orm';

import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableAuthUser,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableMuridMataPelajaran,
	tablePegawai
} from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit';
import { hitungPersen } from '$lib/server/statistik-kelas';
import { isAuthorizedUser } from '../../pengguna/permissions';
import type { PageServerLoad } from './$types';

const REQUIRED_PERMISSION: UserPermission = 'overview_semua_kelas';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		redirect(303, `/forbidden?required=${REQUIRED_PERMISSION}`);
	}

	const sekolahId = locals.sekolah?.id ?? null;
	const kelasId = Number(params.id);
	if (!Number.isInteger(kelasId) || kelasId <= 0) {
		error(400, 'Kelas tidak valid.');
	}

	const kelas = sekolahId
		? await db.query.tableKelas.findFirst({
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId)),
				with: {
					semester: true,
					tahunAjaran: true,
					waliKelas: { columns: { id: true, nama: true, nip: true } },
					waliAsuh: { columns: { id: true, nama: true, nip: true } }
				}
			})
		: null;
	if (!kelas) {
		error(404, 'Kelas tidak ditemukan pada sekolah ini.');
	}

	const muridRows = await db.query.tableMurid.findMany({
		where: and(eq(tableMurid.kelasId, kelasId), eq(tableMurid.semesterId, kelas.semesterId)),
		columns: {
			id: true,
			nis: true,
			nisn: true,
			nama: true,
			jenisKelamin: true,
			waliAsuhNama: true,
			waliId: true
		},
		with: {
			kehadiran: true,
			wali: { columns: { nama: true } }
		},
		orderBy: (murid, { asc }) => [asc(murid.nis)]
	});

	const mapelRows = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelasId),
		columns: { id: true, nama: true, kode: true, kkm: true, jenis: true, pengampuId: true },
		with: {
			pengampu: { columns: { id: true, nama: true, nip: true } },
			authUsers: { columns: { authUserId: true } }
		}
	});

	const muridIds = muridRows.map((murid) => murid.id);
	const mapelIds = mapelRows.map((mapel) => mapel.id);

	const sumatifRows =
		muridIds.length && mapelIds.length
			? await db
					.select({
						muridId: tableAsesmenSumatif.muridId,
						mataPelajaranId: tableAsesmenSumatif.mataPelajaranId,
						nilaiAkhir: tableAsesmenSumatif.nilaiAkhir
					})
					.from(tableAsesmenSumatif)
					.where(
						and(
							inArray(tableAsesmenSumatif.muridId, muridIds),
							inArray(tableAsesmenSumatif.mataPelajaranId, mapelIds)
						)
					)
			: [];

	const mapelMuridRows =
		muridIds.length && mapelIds.length
			? await db
					.select({
						muridId: tableMuridMataPelajaran.muridId,
						mataPelajaranId: tableMuridMataPelajaran.mataPelajaranId
					})
					.from(tableMuridMataPelajaran)
					.where(
						and(
							inArray(tableMuridMataPelajaran.muridId, muridIds),
							inArray(tableMuridMataPelajaran.mataPelajaranId, mapelIds)
						)
					)
			: [];

	const nilaiPerMurid = new Map<number, { terisi: number; jumlah: number; ada: number }>();
	const nilaiPerMapel = new Map<number, { terisi: number; jumlah: number; ada: number }>();
	for (const row of sumatifRows) {
		const entryMurid = nilaiPerMurid.get(row.muridId) ?? { terisi: 0, jumlah: 0, ada: 0 };
		entryMurid.terisi += 1;
		if (typeof row.nilaiAkhir === 'number' && Number.isFinite(row.nilaiAkhir)) {
			entryMurid.jumlah += row.nilaiAkhir;
			entryMurid.ada += 1;
		}
		nilaiPerMurid.set(row.muridId, entryMurid);

		const entryMapel = nilaiPerMapel.get(row.mataPelajaranId) ?? { terisi: 0, jumlah: 0, ada: 0 };
		entryMapel.terisi += 1;
		if (typeof row.nilaiAkhir === 'number' && Number.isFinite(row.nilaiAkhir)) {
			entryMapel.jumlah += row.nilaiAkhir;
			entryMapel.ada += 1;
		}
		nilaiPerMapel.set(row.mataPelajaranId, entryMapel);
	}

	const mapelTerisiPerMurid = new Map<number, number>();
	for (const row of mapelMuridRows) {
		mapelTerisiPerMurid.set(row.muridId, (mapelTerisiPerMurid.get(row.muridId) ?? 0) + 1);
	}

	// Akun guru yang teaching di kelas ini.
	const authUserIds = [
		...new Set(mapelRows.flatMap((mapel) => mapel.authUsers.map((entry) => entry.authUserId)))
	];
	const authUsers = authUserIds.length
		? await db.query.tableAuthUser.findMany({
				where: inArray(tableAuthUser.id, authUserIds),
				columns: { id: true, username: true, namaLengkap: true, type: true, pegawaiId: true }
			})
		: [];
	const authUserMap = new Map(authUsers.map((user) => [user.id, user]));
	const pegawaiIds = [
		...new Set(
			[
				...mapelRows.map((mapel) => mapel.pengampuId),
				...authUsers.map((user) => user.pegawaiId)
			].filter((value): value is number => typeof value === 'number')
		)
	];
	const pegawaiRows = pegawaiIds.length
		? await db.query.tablePegawai.findMany({
				where: inArray(tablePegawai.id, pegawaiIds),
				columns: { id: true, nama: true, nip: true }
			})
		: [];
	const pegawaiMap = new Map(pegawaiRows.map((pegawai) => [pegawai.id, pegawai]));

	const daftarMurid = muridRows.map((murid) => {
		const nilai = nilaiPerMurid.get(murid.id) ?? { terisi: 0, jumlah: 0, ada: 0 };
		const kehadiran = murid.kehadiran ?? null;
		return {
			id: murid.id,
			nis: murid.nis,
			nisn: murid.nisn,
			nama: murid.nama,
			jenisKelamin: murid.jenisKelamin,
			wali: murid.wali?.nama ?? null,
			waliAsuh: murid.waliAsuhNama ?? null,
			nilaiTerisi: nilai.terisi,
			nilaiDiharapkan: mapelIds.length,
			mapelKosong: mapelTerisiPerMurid.get(murid.id) ?? 0,
			rataNilai: nilai.ada > 0 ? Math.round((nilai.jumlah / nilai.ada) * 10) / 10 : null,
			sakit: kehadiran?.sakit ?? 0,
			izin: kehadiran?.izin ?? 0,
			alfa: kehadiran?.alfa ?? 0
		};
	});

	const daftarMapel = mapelRows.map((mapel) => {
		const nilai = nilaiPerMapel.get(mapel.id) ?? { terisi: 0, jumlah: 0, ada: 0 };
		const guruAkun: Array<{ username: string; nama: string; type: string }> = [];
		for (const entry of mapel.authUsers) {
			const user = authUserMap.get(entry.authUserId);
			if (!user) continue;
			const pegawai = user.pegawaiId ? pegawaiMap.get(user.pegawaiId) : null;
			guruAkun.push({
				username: user.username,
				nama: pegawai?.nama ?? user.namaLengkap ?? user.username,
				type: user.type
			});
		}

		return {
			id: mapel.id,
			nama: mapel.nama,
			kode: mapel.kode,
			kkm: mapel.kkm,
			jenis: mapel.jenis,
			pengampu: mapel.pengampu?.nama ?? null,
			pengampuNip: mapel.pengampu?.nip ?? null,
			guruAkun,
			nilaiTerisi: nilai.terisi,
			nilaiDiharapkan: muridRows.length,
			rataNilai: nilai.ada > 0 ? Math.round((nilai.jumlah / nilai.ada) * 10) / 10 : null
		};
	});

	const totalNilaiTerisi = daftarMurid.reduce((sum, murid) => sum + murid.nilaiTerisi, 0);
	const totalNilaiDiharapkan = daftarMurid.length * mapelRows.length;
	const guruUnik = new Set<string>();
	for (const mapel of daftarMapel) {
		if (mapel.pengampu) guruUnik.add(mapel.pengampu);
		for (const guru of mapel.guruAkun) guruUnik.add(guru.nama);
	}

	return {
		meta: { title: `Detail ${kelas.nama}` },
		kelas: {
			id: kelas.id,
			nama: kelas.nama,
			fase: kelas.fase,
			semester: kelas.semester?.nama ?? null,
			tahunAjaran: kelas.tahunAjaran?.nama ?? null,
			waliKelas: kelas.waliKelas?.nama ?? null,
			waliKelasNip: kelas.waliKelas?.nip ?? null,
			waliAsuh: kelas.waliAsuh?.nama ?? null
		},
		ringkasan: {
			jumlahMurid: daftarMurid.length,
			lakiLaki: daftarMurid.filter((murid) => murid.jenisKelamin === 'L').length,
			perempuan: daftarMurid.filter((murid) => murid.jenisKelamin === 'P').length,
			jumlahMapel: daftarMapel.length,
			jumlahGuru: guruUnik.size,
			persenNilai: hitungPersen(totalNilaiTerisi, totalNilaiDiharapkan),
			sakit: daftarMurid.reduce((sum, murid) => sum + murid.sakit, 0),
			izin: daftarMurid.reduce((sum, murid) => sum + murid.izin, 0),
			alfa: daftarMurid.reduce((sum, murid) => sum + murid.alfa, 0)
		},
		daftarMurid,
		daftarMapel
	};
};
