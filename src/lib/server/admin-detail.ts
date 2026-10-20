import db from '$lib/server/db';
import {
	tableAsesmenEkstrakurikuler,
	tableAsesmenFormatif,
	tableAsesmenKokurikuler,
	tableAsesmenSumatif,
	tableAuthUser,
	tableBukuTamu,
	tableCatatanWaliKelas,
	tableDinasLuarPermohonan,
	tableEkstrakurikuler,
	tableJadwalPelajaran,
	tableJurnalMengajar,
	tableKehadiranMurid,
	tableKeputusanMurid,
	tableKelas,
	tableKokurikuler,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tablePortalOrangtua,
	tablePresensiGuru,
	tableSppd,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

export interface KolomDetail {
	key: string;
	label: string;
	format?: 'teks' | 'angka' | 'desimal';
}

export type BarisDetail = Record<string, string | number | null>;

export interface HasilDetail {
	kolom: KolomDetail[];
	baris: BarisDetail[];
	total: number;
	totalHalaman: number;
}

const KOLOM: Record<string, KolomDetail[]> = {
	sekolah: [
		{ key: 'nama', label: 'Nama Sekolah' },
		{ key: 'jenjang', label: 'Jenjang' },
		{ key: 'npsn', label: 'NPSN' },
		{ key: 'alamat', label: 'Alamat' },
		{ key: 'kepala', label: 'Kepala Sekolah' }
	],
	tahun_ajaran: [
		{ key: 'nama', label: 'Tahun Ajaran' },
		{ key: 'mulai', label: 'Mulai' },
		{ key: 'selesai', label: 'Selesai' },
		{ key: 'aktif', label: 'Aktif' },
		{ key: 'semester', label: 'Jumlah Semester', format: 'angka' }
	],
	kelas: [
		{ key: 'nama', label: 'Kelas' },
		{ key: 'fase', label: 'Fase' },
		{ key: 'semester', label: 'Semester' },
		{ key: 'wali', label: 'Wali Kelas' },
		{ key: 'murid', label: 'Murid', format: 'angka' },
		{ key: 'mapel', label: 'Mapel', format: 'angka' },
		{ key: 'nilai', label: 'Nilai', format: 'angka' }
	],
	murid: [
		{ key: 'nis', label: 'NIS' },
		{ key: 'nisn', label: 'NISN' },
		{ key: 'nama', label: 'Nama' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'jk', label: 'JK' },
		{ key: 'agama', label: 'Agama' },
		{ key: 'status', label: 'Status' },
		{ key: 'nilai', label: 'Nilai', format: 'angka' },
		{ key: 'rata', label: 'Rata-rata', format: 'desimal' }
	],
	intrakurikuler: [
		{ key: 'nama', label: 'Mata Pelajaran' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'jenis', label: 'Jenis' },
		{ key: 'kkm', label: 'KKM', format: 'angka' },
		{ key: 'urutan', label: 'Urutan', format: 'angka' },
		{ key: 'pengampu', label: 'Guru Pengampu' },
		{ key: 'nilai', label: 'Nilai', format: 'angka' },
		{ key: 'rata', label: 'Rata-rata', format: 'desimal' }
	],
	kokurikuler: [
		{ key: 'kode', label: 'Kode' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'tujuan', label: 'Tujuan' },
		{ key: 'dimensi', label: 'Dimensi' },
		{ key: 'nilai', label: 'Nilai', format: 'angka' }
	],
	ekstrakurikuler: [
		{ key: 'nama', label: 'Kegiatan' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'tujuan', label: 'Tujuan', format: 'angka' },
		{ key: 'nilai', label: 'Nilai', format: 'angka' }
	],
	pengguna: [
		{ key: 'username', label: 'Username' },
		{ key: 'nama', label: 'Nama Lengkap' },
		{ key: 'tipe', label: 'Tipe' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'izin', label: 'Jumlah Izin', format: 'angka' },
		{ key: 'dibuat', label: 'Dibuat' }
	],
	asesmen_formatif: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'mapel', label: 'Mata Pelajaran' },
		{ key: 'tuntas', label: 'Tuntas' },
		{ key: 'dinilai', label: 'Dinilai Pada' }
	],
	asesmen_sumatif: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'mapel', label: 'Mata Pelajaran' },
		{ key: 'sts', label: 'STS', format: 'desimal' },
		{ key: 'sas', label: 'SAS', format: 'desimal' },
		{ key: 'nilai', label: 'Nilai Akhir', format: 'desimal' }
	],
	asesmen_kokurikuler: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'kegiatan', label: 'Kegiatan' },
		{ key: 'dimensi', label: 'Dimensi' },
		{ key: 'kategori', label: 'Kategori' }
	],
	nilai_ekstrakurikuler: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'kegiatan', label: 'Kegiatan' },
		{ key: 'tujuan', label: 'Tujuan' },
		{ key: 'kategori', label: 'Kategori' }
	],
	presensi_murid: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'sakit', label: 'Sakit', format: 'angka' },
		{ key: 'izin', label: 'Izin', format: 'angka' },
		{ key: 'alfa', label: 'Alfa', format: 'angka' }
	],
	presensi_guru: [
		{ key: 'guru', label: 'Guru' },
		{ key: 'tanggal', label: 'Tanggal' },
		{ key: 'status', label: 'Status' },
		{ key: 'waktu', label: 'Waktu' },
		{ key: 'keterangan', label: 'Keterangan' }
	],
	jadwal: [
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'hari', label: 'Hari' },
		{ key: 'jam', label: 'Jam Ke', format: 'angka' },
		{ key: 'kegiatan', label: 'Kode Kegiatan' }
	],
	jurnal: [
		{ key: 'guru', label: 'Guru' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'mapel', label: 'Mata Pelajaran' },
		{ key: 'tanggal', label: 'Tanggal' },
		{ key: 'materi', label: 'Lingkup Materi' }
	],
	catatan_wali: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'catatan', label: 'Catatan' }
	],
	keputusan: [
		{ key: 'murid', label: 'Murid' },
		{ key: 'kelas', label: 'Kelas' },
		{ key: 'naik', label: 'Naik Kelas' }
	],
	tanda_tangan: [
		{ key: 'nama', label: 'Nama' },
		{ key: 'nip', label: 'NIP' },
		{ key: 'nik', label: 'NIK' },
		{ key: 'status', label: 'Tanda Tangan' }
	],
	portal: [
		{ key: 'nama', label: 'Nama Orang Tua' },
		{ key: 'telepon', label: 'Telepon' },
		{ key: 'anak', label: 'Jumlah Anak', format: 'angka' },
		{ key: 'status', label: 'Status Akun' }
	],
	sppd: [
		{ key: 'nomor', label: 'Nomor Surat Tugas' },
		{ key: 'maksud', label: 'Maksud' },
		{ key: 'tanggal', label: 'Tanggal Surat' },
		{ key: 'berangkat', label: 'Tempat Berangkat' },
		{ key: 'tujuan', label: 'Tempat Tujuan' }
	],
	dinas_luar: [
		{ key: 'nama', label: 'Nama' },
		{ key: 'maksud', label: 'Maksud' },
		{ key: 'dibuat', label: 'Dibuat' }
	],
	buku_tamu: [
		{ key: 'nama', label: 'Nama' },
		{ key: 'instansi', label: 'Asal Instansi' },
		{ key: 'nip', label: 'NIP' },
		{ key: 'keperluan', label: 'Keperluan' }
	]
};

/**
 * Muat data detail satu modul untuk halaman /dashboard-admin/<key>.
 * Seluruh baris diambil langsung dari database.
 */
export async function loadDetail(
	sekolahId: number,
	key: string,
	opsi: { q?: string | null; page?: number; perPage?: number } = {}
): Promise<HasilDetail> {
	const perPage = opsi.perPage ?? 50;
	const page = Math.max(1, opsi.page ?? 1);
	const q = opsi.q?.trim() ?? '';
	const like = `%${q}%`;
	const kelasIds = (
		await db
			.select({ id: tableKelas.id })
			.from(tableKelas)
			.where(eq(tableKelas.sekolahId, sekolahId))
	).map((row) => row.id);

	switch (key) {
		case 'kelas': {
			const rows = await db
				.select({
					id: tableKelas.id,
					nama: tableKelas.nama,
					fase: tableKelas.fase,
					semester: sql<
						string | null
					>`(select s.nama from semester s where s.id = kelas.semester_id)`,
					wali: sql<string | null>`(select p.nama from pegawai p where p.id = kelas.wali_kelas_id)`,
					murid: sql<number>`(select count(*) from murid m where m.kelas_id = kelas.id)`,
					mapel: sql<number>`(select count(*) from mata_pelajaran mp where mp.kelas_id = kelas.id)`,
					nilai: sql<number>`(select count(*) from asesmen_sumatif a join mata_pelajaran mp on mp.id = a.mata_pelajaran_id where mp.kelas_id = kelas.id)`
				})
				.from(tableKelas)
				.where(
					q
						? and(eq(tableKelas.sekolahId, sekolahId), sql`kelas.nama like ${like}`)
						: eq(tableKelas.sekolahId, sekolahId)
				)
				.orderBy(asc(tableKelas.nama))
				.limit(2000);
			return susun('kelas', rows, page, perPage);
		}
		case 'murid': {
			const rows = await db
				.select({
					id: tableMurid.id,
					nis: tableMurid.nis,
					nisn: tableMurid.nisn,
					nama: tableMurid.nama,
					kelas: sql<string | null>`(select k.nama from kelas k where k.id = murid.kelas_id)`,
					jk: tableMurid.jenisKelamin,
					agama: tableMurid.agama,
					status: tableMurid.status,
					nilai: sql<number>`(select count(*) from asesmen_sumatif a where a.murid_id = murid.id)`,
					rata: sql<
						number | null
					>`(select round(avg(a.nilai_akhir), 2) from asesmen_sumatif a where a.murid_id = murid.id and a.nilai_akhir is not null)`
				})
				.from(tableMurid)
				.where(
					q
						? and(
								eq(tableMurid.sekolahId, sekolahId),
								sql`(murid.nama like ${like} or murid.nis like ${like} or murid.nisn like ${like})`
							)
						: eq(tableMurid.sekolahId, sekolahId)
				)
				.orderBy(asc(tableMurid.nama))
				.limit(2000);
			return susun('murid', rows, page, perPage);
		}
		case 'intrakurikuler': {
			const rows = await db
				.select({
					id: tableMataPelajaran.id,
					nama: tableMataPelajaran.nama,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k where k.id = mata_pelajaran.kelas_id)`,
					jenis: tableMataPelajaran.jenis,
					kkm: tableMataPelajaran.kkm,
					urutan: tableMataPelajaran.urutan,
					pengampu: sql<
						string | null
					>`(select p.nama from pegawai p where p.id = mata_pelajaran.pengampu_id)`,
					nilai: sql<number>`(select count(*) from asesmen_sumatif a where a.mata_pelajaran_id = mata_pelajaran.id)`,
					rata: sql<
						number | null
					>`(select round(avg(a.nilai_akhir), 2) from asesmen_sumatif a where a.mata_pelajaran_id = mata_pelajaran.id and a.nilai_akhir is not null)`
				})
				.from(tableMataPelajaran)
				.where(
					q
						? and(
								kelasIds.length ? inArray(tableMataPelajaran.kelasId, kelasIds) : sql`1 = 0`,
								sql`mata_pelajaran.nama like ${like}`
							)
						: kelasIds.length
							? inArray(tableMataPelajaran.kelasId, kelasIds)
							: sql`1 = 0`
				)
				.orderBy(asc(tableMataPelajaran.nama))
				.limit(2000);
			return susun('intrakurikuler', rows, page, perPage);
		}
		case 'pengguna': {
			const rows = await db
				.select({
					id: tableAuthUser.id,
					username: tableAuthUser.username,
					nama: tableAuthUser.namaLengkap,
					tipe: tableAuthUser.type,
					kelas: sql<string | null>`(select k.nama from kelas k where k.id = auth_user.kelas_id)`,
					izin: sql<number>`(select count(*) from json_each(auth_user.permissions))`,
					dibuat: tableAuthUser.createdAt
				})
				.from(tableAuthUser)
				.where(
					q
						? sql`(auth_user.username like ${like} or auth_user.nama_lengkap like ${like})`
						: sql`1 = 1`
				)
				.orderBy(asc(tableAuthUser.username))
				.limit(2000);
			return susun('pengguna', rows, page, perPage);
		}
		case 'kokurikuler': {
			const rows = await db
				.select({
					id: tableKokurikuler.id,
					kode: tableKokurikuler.kode,
					kelas: sql<string | null>`(select k.nama from kelas k where k.id = kokurikuler.kelas_id)`,
					tujuan: tableKokurikuler.tujuan,
					dimensi: sql<string | null>`kokurikuler.dimensi`,
					nilai: sql<number>`(select count(*) from asesmen_kokurikuler a where a.kokurikuler_id = kokurikuler.id)`
				})
				.from(tableKokurikuler)
				.where(
					q
						? and(
								kelasIds.length ? inArray(tableKokurikuler.kelasId, kelasIds) : sql`1 = 0`,
								sql`kokurikuler.kode like ${like}`
							)
						: kelasIds.length
							? inArray(tableKokurikuler.kelasId, kelasIds)
							: sql`1 = 0`
				)
				.orderBy(asc(tableKokurikuler.kode))
				.limit(2000);
			return susun('kokurikuler', rows, page, perPage);
		}
		case 'ekstrakurikuler': {
			const rows = await db
				.select({
					id: tableEkstrakurikuler.id,
					nama: tableEkstrakurikuler.nama,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k where k.id = ekstrakurikuler.kelas_id)`,
					tujuan: sql<number>`(select count(*) from ekstrakurikuler_tujuan t where t.ekstrakurikuler_id = ekstrakurikuler.id)`,
					nilai: sql<number>`(select count(*) from asesmen_ekstrakurikuler a where a.ekstrakurikuler_id = ekstrakurikuler.id)`
				})
				.from(tableEkstrakurikuler)
				.where(
					q
						? and(
								kelasIds.length ? inArray(tableEkstrakurikuler.kelasId, kelasIds) : sql`1 = 0`,
								sql`ekstrakurikuler.nama like ${like}`
							)
						: kelasIds.length
							? inArray(tableEkstrakurikuler.kelasId, kelasIds)
							: sql`1 = 0`
				)
				.orderBy(asc(tableEkstrakurikuler.nama))
				.limit(2000);
			return susun('ekstrakurikuler', rows, page, perPage);
		}
		case 'asesmen_sumatif': {
			const rows = await db
				.select({
					id: tableAsesmenSumatif.id,
					murid: sql<string>`(select m.nama from murid m where m.id = asesmen_sumatif.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = asesmen_sumatif.murid_id)`,
					mapel: sql<string>`(select mp.nama from mata_pelajaran mp where mp.id = asesmen_sumatif.mata_pelajaran_id)`,
					sts: tableAsesmenSumatif.sts,
					sas: tableAsesmenSumatif.sas,
					nilai: tableAsesmenSumatif.nilaiAkhir
				})
				.from(tableAsesmenSumatif)
				.innerJoin(tableMurid, eq(tableAsesmenSumatif.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.orderBy(desc(tableAsesmenSumatif.updatedAt))
				.limit(2000);
			return susun('asesmen_sumatif', rows, page, perPage);
		}
		case 'asesmen_formatif': {
			const rows = await db
				.select({
					id: tableAsesmenFormatif.id,
					murid: sql<string>`(select m.nama from murid m where m.id = asesmen_formatif.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = asesmen_formatif.murid_id)`,
					mapel: sql<string>`(select mp.nama from mata_pelajaran mp where mp.id = asesmen_formatif.mata_pelajaran_id)`,
					tuntas: sql<string>`case when asesmen_formatif.tuntas = 1 then 'Ya' else 'Tidak' end`,
					dinilai: tableAsesmenFormatif.dinilaiPada
				})
				.from(tableAsesmenFormatif)
				.innerJoin(tableMurid, eq(tableAsesmenFormatif.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.orderBy(desc(tableAsesmenFormatif.updatedAt))
				.limit(2000);
			return susun('asesmen_formatif', rows, page, perPage);
		}
		case 'asesmen_kokurikuler': {
			const rows = await db
				.select({
					id: tableAsesmenKokurikuler.id,
					murid: sql<string>`(select m.nama from murid m where m.id = asesmen_kokurikuler.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = asesmen_kokurikuler.murid_id)`,
					kegiatan: sql<string>`(select kk.kode from kokurikuler kk where kk.id = asesmen_kokurikuler.kokurikuler_id)`,
					dimensi: tableAsesmenKokurikuler.dimensi,
					kategori: tableAsesmenKokurikuler.kategori
				})
				.from(tableAsesmenKokurikuler)
				.innerJoin(tableMurid, eq(tableAsesmenKokurikuler.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.limit(2000);
			return susun('asesmen_kokurikuler', rows, page, perPage);
		}
		case 'nilai_ekstrakurikuler': {
			const rows = await db
				.select({
					id: tableAsesmenEkstrakurikuler.id,
					murid: sql<string>`(select m.nama from murid m where m.id = asesmen_ekstrakurikuler.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = asesmen_ekstrakurikuler.murid_id)`,
					kegiatan: sql<string>`(select e.nama from ekstrakurikuler e where e.id = asesmen_ekstrakurikuler.ekstrakurikuler_id)`,
					tujuan: sql<
						string | null
					>`(select t.deskripsi from ekstrakurikuler_tujuan t where t.id = asesmen_ekstrakurikuler.tujuan_id)`,
					kategori: tableAsesmenEkstrakurikuler.kategori
				})
				.from(tableAsesmenEkstrakurikuler)
				.innerJoin(tableMurid, eq(tableAsesmenEkstrakurikuler.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.limit(2000);
			return susun('nilai_ekstrakurikuler', rows, page, perPage);
		}
		case 'presensi_murid': {
			const rows = await db
				.select({
					id: tableKehadiranMurid.id,
					murid: sql<string>`(select m.nama from murid m where m.id = kehadiran_murid.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = kehadiran_murid.murid_id)`,
					sakit: tableKehadiranMurid.sakit,
					izin: tableKehadiranMurid.izin,
					alfa: tableKehadiranMurid.alfa
				})
				.from(tableKehadiranMurid)
				.innerJoin(tableMurid, eq(tableKehadiranMurid.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.orderBy(asc(tableMurid.nama))
				.limit(2000);
			return susun('presensi_murid', rows, page, perPage);
		}
		case 'presensi_guru': {
			const rows = await db
				.select({
					id: tablePresensiGuru.id,
					guru: sql<
						string | null
					>`(select p.nama from auth_user u join pegawai p on p.id = u.pegawai_id where u.id = presensi_guru.auth_user_id)`,
					tanggal: tablePresensiGuru.tanggal,
					status: tablePresensiGuru.status,
					waktu: tablePresensiGuru.waktu,
					keterangan: tablePresensiGuru.keterangan
				})
				.from(tablePresensiGuru)
				.where(
					q
						? and(
								eq(tablePresensiGuru.sekolahId, sekolahId),
								sql`presensi_guru.status like ${like}`
							)
						: eq(tablePresensiGuru.sekolahId, sekolahId)
				)
				.orderBy(desc(tablePresensiGuru.tanggal))
				.limit(2000);
			return susun('presensi_guru', rows, page, perPage);
		}
		case 'jadwal': {
			const rows = await db
				.select({
					id: tableJadwalPelajaran.id,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k where k.id = jadwal_pelajaran.kelas_id)`,
					hari: tableJadwalPelajaran.hari,
					jam: tableJadwalPelajaran.jamKe,
					kegiatan: tableJadwalPelajaran.kodeKegiatan
				})
				.from(tableJadwalPelajaran)
				.where(
					q
						? and(
								eq(tableJadwalPelajaran.sekolahId, sekolahId),
								sql`jadwal_pelajaran.hari like ${like}`
							)
						: eq(tableJadwalPelajaran.sekolahId, sekolahId)
				)
				.orderBy(asc(tableJadwalPelajaran.hari))
				.limit(2000);
			return susun('jadwal', rows, page, perPage);
		}
		case 'jurnal': {
			const rows = await db
				.select({
					id: tableJurnalMengajar.id,
					guru: sql<
						string | null
					>`(select p.nama from auth_user u join pegawai p on p.id = u.pegawai_id where u.id = jurnal_mengajar.auth_user_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k where k.id = jurnal_mengajar.kelas_id)`,
					mapel: sql<
						string | null
					>`(select mp.nama from mata_pelajaran mp where mp.id = jurnal_mengajar.mata_pelajaran_id)`,
					tanggal: tableJurnalMengajar.tanggal,
					materi: tableJurnalMengajar.lingkupMateri
				})
				.from(tableJurnalMengajar)
				.where(
					q
						? and(
								kelasIds.length ? inArray(tableJurnalMengajar.kelasId, kelasIds) : sql`1 = 0`,
								sql`jurnal_mengajar.lingkup_materi like ${like}`
							)
						: kelasIds.length
							? inArray(tableJurnalMengajar.kelasId, kelasIds)
							: sql`1 = 0`
				)
				.orderBy(desc(tableJurnalMengajar.tanggal))
				.limit(2000);
			return susun('jurnal', rows, page, perPage);
		}
		case 'catatan_wali': {
			const rows = await db
				.select({
					id: tableCatatanWaliKelas.id,
					murid: sql<string>`(select m.nama from murid m where m.id = catatan_wali_kelas.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = catatan_wali_kelas.murid_id)`,
					catatan: tableCatatanWaliKelas.catatan
				})
				.from(tableCatatanWaliKelas)
				.innerJoin(tableMurid, eq(tableCatatanWaliKelas.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.orderBy(asc(tableMurid.nama))
				.limit(2000);
			return susun('catatan_wali', rows, page, perPage);
		}
		case 'keputusan': {
			const rows = await db
				.select({
					id: tableKeputusanMurid.id,
					murid: sql<string>`(select m.nama from murid m where m.id = keputusan_murid.murid_id)`,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k join murid m on m.kelas_id = k.id where m.id = keputusan_murid.murid_id)`,
					naik: sql<string>`case when keputusan_murid.naik = 1 then 'Naik' else 'Tidak Naik' end`
				})
				.from(tableKeputusanMurid)
				.innerJoin(tableMurid, eq(tableKeputusanMurid.muridId, tableMurid.id))
				.where(eq(tableMurid.sekolahId, sekolahId))
				.orderBy(asc(tableMurid.nama))
				.limit(2000);
			return susun('keputusan', rows, page, perPage);
		}
		case 'tanda_tangan': {
			const rows = await db
				.select({
					id: tablePegawai.id,
					nama: tablePegawai.nama,
					nip: tablePegawai.nip,
					nik: tablePegawai.nik,
					status: sql<string>`case when pegawai.tanda_tangan is null then 'Belum ada' else 'Sudah ada' end`
				})
				.from(tablePegawai)
				.where(
					q
						? and(eq(tablePegawai.sekolahId, sekolahId), sql`pegawai.nama like ${like}`)
						: eq(tablePegawai.sekolahId, sekolahId)
				)
				.orderBy(asc(tablePegawai.nama))
				.limit(2000);
			return susun('tanda_tangan', rows, page, perPage);
		}
		case 'tahun_ajaran': {
			const rows = await db
				.select({
					id: tableTahunAjaran.id,
					nama: tableTahunAjaran.nama,
					mulai: tableTahunAjaran.tanggalMulai,
					selesai: tableTahunAjaran.tanggalSelesai,
					aktif: sql<string>`case when tahun_ajaran.is_aktif = 1 then 'Ya' else 'Tidak' end`,
					semester: sql<number>`(select count(*) from semester s where s.tahun_ajaran_id = tahun_ajaran.id)`
				})
				.from(tableTahunAjaran)
				.where(eq(tableTahunAjaran.sekolahId, sekolahId))
				.orderBy(desc(tableTahunAjaran.nama))
				.limit(2000);
			return susun('tahun_ajaran', rows, page, perPage);
		}
		case 'portal': {
			const rows = await db
				.select({
					id: tablePortalOrangtua.id,
					nama: tablePortalOrangtua.nama,
					telepon: tablePortalOrangtua.telepon,
					anak: sql<number>`(select count(*) from portal_orangtua_murid pm where pm.orangtua_id = portal_orangtua.id)`,
					status: sql<string>`case when portal_orangtua.is_active = 0 then 'Nonaktif' when portal_orangtua.must_change_password = 1 then 'Perlu ganti sandi' else 'Aktif' end`
				})
				.from(tablePortalOrangtua)
				.where(eq(tablePortalOrangtua.sekolahId, sekolahId))
				.limit(2000);
			return susun('portal', rows, page, perPage);
		}
		case 'sppd': {
			const rows = await db
				.select({
					id: tableSppd.id,
					nomor: tableSppd.nomorSuratTugas,
					maksud: tableSppd.maksud,
					tanggal: tableSppd.tanggalSuratTugas,
					berangkat: tableSppd.tempatBerangkat,
					tujuan: tableSppd.tempatTujuan
				})
				.from(tableSppd)
				.where(eq(tableSppd.sekolahId, sekolahId))
				.orderBy(desc(tableSppd.tanggalSuratTugas))
				.limit(2000);
			return susun('sppd', rows, page, perPage);
		}
		case 'dinas_luar': {
			const rows = await db
				.select({
					id: tableDinasLuarPermohonan.id,
					nama: tableDinasLuarPermohonan.nama,
					maksud: tableDinasLuarPermohonan.maksud,
					dibuat: tableDinasLuarPermohonan.createdAt
				})
				.from(tableDinasLuarPermohonan)
				.where(eq(tableDinasLuarPermohonan.sekolahId, sekolahId))
				.orderBy(desc(tableDinasLuarPermohonan.createdAt))
				.limit(2000);
			return susun('dinas_luar', rows, page, perPage);
		}
		case 'buku_tamu': {
			const rows = await db
				.select({
					id: tableBukuTamu.id,
					nama: tableBukuTamu.nama,
					instansi: tableBukuTamu.asalInstansi,
					nip: tableBukuTamu.nip,
					keperluan: tableBukuTamu.keperluan
				})
				.from(tableBukuTamu)
				.where(eq(tableBukuTamu.sekolahId, sekolahId))
				.orderBy(desc(tableBukuTamu.createdAt))
				.limit(2000);
			return susun('buku_tamu', rows, page, perPage);
		}
		default:
			return { kolom: KOLOM[key] ?? [], baris: [], total: 0, totalHalaman: 1 };
	}
}

function susun(
	key: string,
	rows: Array<Record<string, unknown>>,
	page: number,
	perPage: number
): HasilDetail {
	const total = rows.length;
	const totalHalaman = Math.max(1, Math.ceil(total / perPage));
	const mulai = (page - 1) * perPage;
	return {
		kolom: KOLOM[key] ?? [],
		baris: rows.slice(mulai, mulai + perPage) as BarisDetail[],
		total,
		totalHalaman
	};
}
