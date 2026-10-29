import { and, eq, inArray } from 'drizzle-orm';

import db from '$lib/server/db';
import { queryInChunks } from '$lib/server/db/chunk';
import {
	tableAsesmenSumatif,
	tableAuthUser,
	tableAuthUserMataPelajaran,
	tableKehadiranMurid,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai
} from '$lib/server/db/schema';

/**
 * Ringkasan seluruh kelas untuk monitoring admin.
 *
 * Satu sumber data dipakai oleh halaman "Semua Kelas" (/semua-kelas) dan kartu
 * ringkasan di dashboard, supaya angka yang tampil di dua tempat selalu sama.
 */

export interface RingkasanKelasRow {
	id: number;
	nama: string;
	fase: string | null;
	waliKelas: string | null;
	waliAsuh: string | null;
	jumlahMurid: number;
	jumlahLakiLaki: number;
	jumlahPerempuan: number;
	jumlahMapel: number;
	jumlahGuru: number;
	guru: string[];
	nilaiTerisi: number;
	nilaiDiharapkan: number;
	persenNilai: number;
	rataNilai: number | null;
	sakit: number;
	izin: number;
	alfa: number;
	muridDenganPresensi: number;
	perluPerhatian: boolean;
}

export interface RingkasanKelasTotal {
	totalKelas: number;
	totalMurid: number;
	totalLakiLaki: number;
	totalPerempuan: number;
	totalGuru: number;
	persenNilai: number;
	kelasPerluPerhatian: number;
}

export function hitungPersen(completed: number, total: number) {
	return total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
}

function namaNatural(a: string, b: string) {
	return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
}

/**
 * Hitung ringkasan per kelas untuk satu semester.
 * `semesterId` kosong/null berarti semua kelas di sekolah.
 */
export async function getRingkasanKelas(
	sekolahId: number,
	semesterId: number | null
): Promise<{ daftarKelas: RingkasanKelasRow[]; ringkasan: RingkasanKelasTotal }> {
	const kelasWhere = semesterId
		? and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, semesterId))
		: eq(tableKelas.sekolahId, sekolahId);

	const kelasRows = await db.query.tableKelas.findMany({
		where: kelasWhere,
		columns: { id: true, nama: true, fase: true, waliKelasId: true, waliAsuhId: true }
	});

	const ringkasan: RingkasanKelasTotal = {
		totalKelas: 0,
		totalMurid: 0,
		totalLakiLaki: 0,
		totalPerempuan: 0,
		totalGuru: 0,
		persenNilai: 0,
		kelasPerluPerhatian: 0
	};

	if (kelasRows.length === 0) {
		return { daftarKelas: [], ringkasan };
	}

	const kelasIds = kelasRows.map((kelas) => kelas.id);

	const muridWhere = semesterId
		? and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.semesterId, semesterId))
		: eq(tableMurid.sekolahId, sekolahId);
	const muridRows = await db.query.tableMurid.findMany({
		where: muridWhere,
		columns: { id: true, kelasId: true, jenisKelamin: true }
	});
	const muridIds = muridRows.map((murid) => murid.id);
	const muridKelas = new Map(muridRows.map((murid) => [murid.id, murid.kelasId]));

	const mapelRows = await db.query.tableMataPelajaran.findMany({
		where: inArray(tableMataPelajaran.kelasId, kelasIds),
		columns: { id: true, kelasId: true }
	});
	const mapelIds = mapelRows.map((mapel) => mapel.id);
	const mapelKelas = new Map(mapelRows.map((mapel) => [mapel.id, mapel.kelasId]));

	const sumatifRows = await queryInChunks(muridIds, (ids) =>
		db.query.tableAsesmenSumatif.findMany({
			where: inArray(tableAsesmenSumatif.muridId, ids),
			columns: { muridId: true, mataPelajaranId: true, nilaiAkhir: true }
		})
	);

	const kehadiranRows = await queryInChunks(muridIds, (ids) =>
		db.query.tableKehadiranMurid.findMany({
			where: inArray(tableKehadiranMurid.muridId, ids),
			columns: { muridId: true, sakit: true, izin: true, alfa: true }
		})
	);

	const assignmentRows = await queryInChunks(mapelIds, (ids) =>
		db.query.tableAuthUserMataPelajaran.findMany({
			where: inArray(tableAuthUserMataPelajaran.mataPelajaranId, ids),
			columns: { authUserId: true, mataPelajaranId: true }
		})
	);

	const authUserIds = [...new Set(assignmentRows.map((row) => row.authUserId))];
	const authUsers = authUserIds.length
		? await db.query.tableAuthUser.findMany({
				where: inArray(tableAuthUser.id, authUserIds),
				columns: { id: true, username: true, namaLengkap: true, pegawaiId: true }
			})
		: [];
	const authUserMap = new Map(authUsers.map((user) => [user.id, user]));

	const pegawaiIds = [
		...new Set(
			[
				...kelasRows.map((kelas) => kelas.waliKelasId),
				...kelasRows.map((kelas) => kelas.waliAsuhId),
				...authUsers.map((user) => user.pegawaiId)
			].filter((value): value is number => typeof value === 'number')
		)
	];
	const pegawaiRows = pegawaiIds.length
		? await db.query.tablePegawai.findMany({
				where: inArray(tablePegawai.id, pegawaiIds),
				columns: { id: true, nama: true }
			})
		: [];
	const pegawaiMap = new Map(pegawaiRows.map((pegawai) => [pegawai.id, pegawai]));

	function namaGuru(authUserId: number) {
		const user = authUserMap.get(authUserId);
		if (!user) return null;
		if (user.pegawaiId) {
			const pegawai = pegawaiMap.get(user.pegawaiId);
			if (pegawai?.nama) return pegawai.nama;
		}
		return user.namaLengkap || user.username;
	}

	const mapelPerKelas = new Map<number, number>();
	for (const mapel of mapelRows) {
		mapelPerKelas.set(mapel.kelasId, (mapelPerKelas.get(mapel.kelasId) ?? 0) + 1);
	}

	const muridPerKelas = new Map<number, { total: number; lakiLaki: number; perempuan: number }>();
	for (const murid of muridRows) {
		const entry = muridPerKelas.get(murid.kelasId) ?? { total: 0, lakiLaki: 0, perempuan: 0 };
		entry.total += 1;
		if (murid.jenisKelamin === 'L') entry.lakiLaki += 1;
		else entry.perempuan += 1;
		muridPerKelas.set(murid.kelasId, entry);
	}

	const guruPerKelas = new Map<number, Set<string>>();
	for (const assignment of assignmentRows) {
		const kelasId = mapelKelas.get(assignment.mataPelajaranId);
		if (kelasId == null) continue;
		const nama = namaGuru(assignment.authUserId);
		if (!nama) continue;
		const set = guruPerKelas.get(kelasId) ?? new Set<string>();
		set.add(nama);
		guruPerKelas.set(kelasId, set);
	}

	const nilaiPerKelas = new Map<
		number,
		{ terisi: number; jumlahNilai: number; adaNilai: number }
	>();
	for (const row of sumatifRows) {
		const kelasId = muridKelas.get(row.muridId);
		if (kelasId == null) continue;
		const entry = nilaiPerKelas.get(kelasId) ?? { terisi: 0, jumlahNilai: 0, adaNilai: 0 };
		entry.terisi += 1;
		if (typeof row.nilaiAkhir === 'number' && Number.isFinite(row.nilaiAkhir)) {
			entry.jumlahNilai += row.nilaiAkhir;
			entry.adaNilai += 1;
		}
		nilaiPerKelas.set(kelasId, entry);
	}

	const kehadiranPerKelas = new Map<
		number,
		{ sakit: number; izin: number; alfa: number; murid: number }
	>();
	for (const row of kehadiranRows) {
		const kelasId = muridKelas.get(row.muridId);
		if (kelasId == null) continue;
		const entry = kehadiranPerKelas.get(kelasId) ?? { sakit: 0, izin: 0, alfa: 0, murid: 0 };
		entry.sakit += row.sakit ?? 0;
		entry.izin += row.izin ?? 0;
		entry.alfa += row.alfa ?? 0;
		entry.murid += 1;
		kehadiranPerKelas.set(kelasId, entry);
	}

	const daftarKelas = kelasRows
		.map((kelas) => {
			const murid = muridPerKelas.get(kelas.id) ?? { total: 0, lakiLaki: 0, perempuan: 0 };
			const jumlahMapel = mapelPerKelas.get(kelas.id) ?? 0;
			const guru = [...(guruPerKelas.get(kelas.id) ?? new Set<string>())].sort(namaNatural);
			const nilai = nilaiPerKelas.get(kelas.id) ?? { terisi: 0, jumlahNilai: 0, adaNilai: 0 };
			const kehadiran = kehadiranPerKelas.get(kelas.id) ?? {
				sakit: 0,
				izin: 0,
				alfa: 0,
				murid: 0
			};

			const expected = murid.total * jumlahMapel;
			const persenNilai = hitungPersen(nilai.terisi, expected);
			const rataNilai = nilai.adaNilai > 0 ? nilai.jumlahNilai / nilai.adaNilai : null;

			return {
				id: kelas.id,
				nama: kelas.nama,
				fase: kelas.fase,
				waliKelas: kelas.waliKelasId ? (pegawaiMap.get(kelas.waliKelasId)?.nama ?? null) : null,
				waliAsuh: kelas.waliAsuhId ? (pegawaiMap.get(kelas.waliAsuhId)?.nama ?? null) : null,
				jumlahMurid: murid.total,
				jumlahLakiLaki: murid.lakiLaki,
				jumlahPerempuan: murid.perempuan,
				jumlahMapel,
				jumlahGuru: guru.length,
				guru,
				nilaiTerisi: nilai.terisi,
				nilaiDiharapkan: expected,
				persenNilai,
				rataNilai: rataNilai == null ? null : Math.round(rataNilai * 10) / 10,
				sakit: kehadiran.sakit,
				izin: kehadiran.izin,
				alfa: kehadiran.alfa,
				muridDenganPresensi: kehadiran.murid,
				perluPerhatian: murid.total > 0 && persenNilai < 50
			} satisfies RingkasanKelasRow;
		})
		.sort((a, b) => namaNatural(a.nama, b.nama));

	const totalNilaiTerisi = daftarKelas.reduce((sum, kelas) => sum + kelas.nilaiTerisi, 0);
	const totalNilaiDiharapkan = daftarKelas.reduce((sum, kelas) => sum + kelas.nilaiDiharapkan, 0);
	const semuaGuru = new Set(daftarKelas.flatMap((kelas) => kelas.guru));

	ringkasan.totalKelas = daftarKelas.length;
	ringkasan.totalMurid = daftarKelas.reduce((sum, kelas) => sum + kelas.jumlahMurid, 0);
	ringkasan.totalLakiLaki = daftarKelas.reduce((sum, kelas) => sum + kelas.jumlahLakiLaki, 0);
	ringkasan.totalPerempuan = daftarKelas.reduce((sum, kelas) => sum + kelas.jumlahPerempuan, 0);
	ringkasan.totalGuru = semuaGuru.size;
	ringkasan.persenNilai = hitungPersen(totalNilaiTerisi, totalNilaiDiharapkan);
	ringkasan.kelasPerluPerhatian = daftarKelas.filter((kelas) => kelas.perluPerhatian).length;

	return { daftarKelas, ringkasan };
}
