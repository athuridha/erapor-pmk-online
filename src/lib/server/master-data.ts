import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableAuthUser,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { MASTER_DATA } from '$lib/master-data';

export interface OpsiRelasi {
	value: number;
	label: string;
}

export type PetaRelasi = Partial<
	Record<'kelas' | 'mapel' | 'pegawai' | 'tahun_ajaran' | 'semester', OpsiRelasi[]>
>;

/** Daftar pilihan relasi yang dipakai form master data. */
export async function loadOpsiRelasi(sekolahId: number): Promise<PetaRelasi> {
	const [tahunAjaran, semester, kelas, mapel, pegawai] = await Promise.all([
		db
			.select({ id: tableTahunAjaran.id, nama: tableTahunAjaran.nama })
			.from(tableTahunAjaran)
			.where(eq(tableTahunAjaran.sekolahId, sekolahId))
			.orderBy(desc(tableTahunAjaran.nama)),
		db
			.select({
				id: tableSemester.id,
				nama: tableSemester.nama,
				tahunAjaran: tableSemester.tahunAjaranId
			})
			.from(tableSemester)
			.innerJoin(tableTahunAjaran, eq(tableSemester.tahunAjaranId, tableTahunAjaran.id))
			.where(eq(tableTahunAjaran.sekolahId, sekolahId))
			.orderBy(asc(tableTahunAjaran.nama), asc(tableSemester.tipe)),
		db
			.select({ id: tableKelas.id, nama: tableKelas.nama })
			.from(tableKelas)
			.where(eq(tableKelas.sekolahId, sekolahId))
			.orderBy(asc(tableKelas.nama)),
		db
			.select({ id: tableMataPelajaran.id, nama: tableMataPelajaran.nama })
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
			.where(eq(tableKelas.sekolahId, sekolahId))
			.orderBy(asc(tableMataPelajaran.nama)),
		db
			.select({ id: tablePegawai.id, nama: tablePegawai.nama })
			.from(tablePegawai)
			.where(eq(tablePegawai.sekolahId, sekolahId))
			.orderBy(asc(tablePegawai.nama))
	]);

	return {
		tahun_ajaran: tahunAjaran.map((row) => ({ value: row.id, label: row.nama })),
		semester: semester.map((row) => ({
			value: row.id,
			label: `${row.nama} (${row.tahunAjaran})`
		})),
		kelas: kelas.map((row) => ({ value: row.id, label: row.nama })),
		mapel: mapel.map((row) => ({ value: row.id, label: row.nama })),
		pegawai: pegawai.map((row) => ({ value: row.id, label: row.nama }))
	};
}

export interface BarisMaster {
	id: number;
	[key: string]: string | number | null;
}

/** Baris tabel master data untuk satu entitas. */
export async function loadBarisMaster(
	sekolahId: number,
	key: string,
	opsi: { q?: string | null } = {}
): Promise<BarisMaster[]> {
	const q = opsi.q?.trim() ?? '';
	const like = `%${q}%`;

	switch (key) {
		case 'tahun_ajaran': {
			const rows = await db
				.select({
					id: tableTahunAjaran.id,
					nama: tableTahunAjaran.nama,
					tanggal_mulai: tableTahunAjaran.tanggalMulai,
					tanggal_selesai: tableTahunAjaran.tanggalSelesai,
					is_aktif: tableTahunAjaran.isAktif
				})
				.from(tableTahunAjaran)
				.where(
					q
						? and(eq(tableTahunAjaran.sekolahId, sekolahId), sql`tahun_ajaran.nama like ${like}`)
						: eq(tableTahunAjaran.sekolahId, sekolahId)
				)
				.orderBy(desc(tableTahunAjaran.nama));
			return rows.map((row) => ({ ...row, is_aktif: row.is_aktif ? 'Ya' : 'Tidak' }));
		}
		case 'semester': {
			const rows = await db
				.select({
					id: tableSemester.id,
					nama: tableSemester.nama,
					tahun_ajaran: sql<string>`(select ta.nama from tahun_ajaran ta where ta.id = semester.tahun_ajaran_id)`,
					tipe: tableSemester.tipe,
					tanggal_mulai: tableSemester.tanggalMulai,
					tanggal_selesai: tableSemester.tanggalSelesai,
					tanggal_bagi_raport: tableSemester.tanggalBagiRaport,
					tanggal_masuk: tableSemester.tanggalMasuk,
					is_aktif: tableSemester.isAktif
				})
				.from(tableSemester)
				.innerJoin(tableTahunAjaran, eq(tableSemester.tahunAjaranId, tableTahunAjaran.id))
				.where(eq(tableTahunAjaran.sekolahId, sekolahId))
				.orderBy(desc(tableTahunAjaran.nama), asc(tableSemester.tipe));
			return rows.map((row) => ({ ...row, is_aktif: row.is_aktif ? 'Ya' : 'Tidak' }));
		}
		case 'kelas': {
			const rows = await db
				.select({
					id: tableKelas.id,
					nama: tableKelas.nama,
					fase: tableKelas.fase,
					semester: sql<
						string | null
					>`(select s.nama from semester s where s.id = kelas.semester_id)`,
					wali_kelas: sql<
						string | null
					>`(select p.nama from pegawai p where p.id = kelas.wali_kelas_id)`,
					jumlah_murid: sql<number>`(select count(*) from murid m where m.kelas_id = kelas.id)`
				})
				.from(tableKelas)
				.where(
					q
						? and(eq(tableKelas.sekolahId, sekolahId), sql`kelas.nama like ${like}`)
						: eq(tableKelas.sekolahId, sekolahId)
				)
				.orderBy(asc(tableKelas.nama));
			return rows;
		}
		case 'mata_pelajaran': {
			const rows = await db
				.select({
					id: tableMataPelajaran.id,
					nama: tableMataPelajaran.nama,
					kelas: sql<
						string | null
					>`(select k.nama from kelas k where k.id = mata_pelajaran.kelas_id)`,
					jenis: tableMataPelajaran.jenis,
					kode: tableMataPelajaran.kode,
					kkm: tableMataPelajaran.kkm,
					urutan: tableMataPelajaran.urutan,
					pengampu: sql<
						string | null
					>`(select p.nama from pegawai p where p.id = mata_pelajaran.pengampu_id)`
				})
				.from(tableMataPelajaran)
				.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
				.where(
					q
						? and(eq(tableKelas.sekolahId, sekolahId), sql`mata_pelajaran.nama like ${like}`)
						: eq(tableKelas.sekolahId, sekolahId)
				)
				.orderBy(asc(tableMataPelajaran.nama));
			return rows;
		}
		case 'pegawai': {
			const rows = await db
				.select({
					id: tablePegawai.id,
					nama: tablePegawai.nama,
					nip: tablePegawai.nip,
					nik: tablePegawai.nik,
					nuptk: tablePegawai.nuptk,
					dapodik_ptk_id: tablePegawai.dapodikPtkId
				})
				.from(tablePegawai)
				.where(
					q
						? and(eq(tablePegawai.sekolahId, sekolahId), sql`pegawai.nama like ${like}`)
						: eq(tablePegawai.sekolahId, sekolahId)
				)
				.orderBy(asc(tablePegawai.nama));
			return rows;
		}
		case 'sekolah': {
			const rows = await db
				.select({
					id: tableSekolah.id,
					nama: tableSekolah.nama,
					npsn: tableSekolah.npsn,
					email: tableSekolah.email,
					website: tableSekolah.website,
					jenjang_pendidikan: tableSekolah.jenjangPendidikan,
					jenjang_variant: tableSekolah.jenjangVariant,
					sumatif_bobot_lingkup: tableSekolah.sumatifBobotLingkup,
					sumatif_bobot_sts: tableSekolah.sumatifBobotSts,
					sumatif_bobot_sas: tableSekolah.sumatifBobotSas,
					sumatif_bobot_rts_lingkup: tableSekolah.sumatifBobotRtsLingkup,
					sumatif_bobot_rts_sts: tableSekolah.sumatifBobotRtsSts,
					rapor_kriteria_cukup: tableSekolah.raporKriteriaCukup,
					rapor_kriteria_baik: tableSekolah.raporKriteriaBaik,
					status_kepala_sekolah: tableSekolah.statusKepalaSekolah
				})
				.from(tableSekolah)
				.where(eq(tableSekolah.id, sekolahId));
			return rows;
		}
		default:
			return [];
	}
}

export interface HasilSimpan {
	message?: string;
	fail?: string;
}

function teks(formData: FormData, key: string) {
	const nilai = formData.get(key);
	return typeof nilai === 'string' ? nilai.trim() : '';
}

function angkaAtau(formData: FormData, key: string, fallback: number | null) {
	const mentah = teks(formData, key);
	if (mentah === '') return fallback;
	const nilai = Number(mentah);
	return Number.isFinite(nilai) ? nilai : fallback;
}

/**
 * Simpan data master data (tambah atau ubah).
 *
 * Validasi wajib dicek di sini; kolom yang tidak ada di form tetap utuh.
 */
export async function simpanMasterData(
	sekolahId: number,
	key: string,
	id: number | null,
	formData: FormData
): Promise<HasilSimpan> {
	const definisi = MASTER_DATA.find((item) => item.key === key);
	if (!definisi) return { fail: 'Jenis master data tidak dikenal.' };

	for (const field of definisi.fields) {
		if (field.wajib && teks(formData, field.key) === '' && field.tipe !== 'toggle') {
			return { fail: `${field.label} wajib diisi.` };
		}
	}

	const now = new Date().toISOString();

	switch (key) {
		case 'tahun_ajaran': {
			const values = {
				nama: teks(formData, 'nama'),
				tanggalMulai: teks(formData, 'tanggal_mulai') || null,
				tanggalSelesai: teks(formData, 'tanggal_selesai') || null,
				isAktif: formData.get('is_aktif') === 'on' || formData.get('is_aktif') === 'true',
				updatedAt: now
			};
			if (id) {
				await db
					.update(tableTahunAjaran)
					.set(values)
					.where(and(eq(tableTahunAjaran.id, id), eq(tableTahunAjaran.sekolahId, sekolahId)));
				return { message: 'Tahun ajaran diperbarui.' };
			}
			await db.insert(tableTahunAjaran).values({ ...values, sekolahId, createdAt: now });
			return { message: 'Tahun ajaran ditambahkan.' };
		}
		case 'semester': {
			const tahunAjaranId = Number(teks(formData, 'tahun_ajaran_id'));
			if (!tahunAjaranId) return { fail: 'Tahun ajaran wajib dipilih.' };
			const [tahunAjaran] = await db
				.select({ id: tableTahunAjaran.id })
				.from(tableTahunAjaran)
				.where(
					and(eq(tableTahunAjaran.id, tahunAjaranId), eq(tableTahunAjaran.sekolahId, sekolahId))
				);
			if (!tahunAjaran) return { fail: 'Tahun ajaran tidak valid.' };
			const values = {
				tahunAjaranId,
				tipe: (teks(formData, 'tipe') || 'ganjil') as 'ganjil' | 'genap',
				nama: teks(formData, 'nama'),
				tanggalMulai: teks(formData, 'tanggal_mulai') || null,
				tanggalSelesai: teks(formData, 'tanggal_selesai') || null,
				tanggalBagiRapor: teks(formData, 'tanggal_bagi_raport') || null,
				tanggalMasuk: teks(formData, 'tanggal_masuk') || null,
				isAktif: formData.get('is_aktif') === 'on' || formData.get('is_aktif') === 'true',
				updatedAt: now
			};
			if (id) {
				const tahunAjaranIds = (
					await db
						.select({ id: tableTahunAjaran.id })
						.from(tableTahunAjaran)
						.where(eq(tableTahunAjaran.sekolahId, sekolahId))
				).map((row) => row.id);
				if (!tahunAjaranIds.length) return { fail: 'Data tidak ditemukan di sekolah ini.' };
				await db
					.update(tableSemester)
					.set(values)
					.where(
						and(eq(tableSemester.id, id), inArray(tableSemester.tahunAjaranId, tahunAjaranIds))
					);
				return { message: 'Semester diperbarui.' };
			}
			await db.insert(tableSemester).values({ ...values, createdAt: now });
			return { message: 'Semester ditambahkan.' };
		}
		case 'kelas': {
			const tahunAjaranId = Number(teks(formData, 'tahun_ajaran_id'));
			const semesterId = Number(teks(formData, 'semester_id'));
			if (!tahunAjaranId || !semesterId) {
				return { fail: 'Tahun ajaran dan semester wajib dipilih.' };
			}
			const waliKelasId = Number(teks(formData, 'wali_kelas_id')) || null;
			const waliAsuhId = Number(teks(formData, 'wali_asuh_id')) || null;
			const values = {
				nama: teks(formData, 'nama'),
				tahunAjaranId,
				semesterId,
				fase: teks(formData, 'fase') || null,
				waliKelasId,
				waliAsuhId,
				updatedAt: now
			};
			if (id) {
				await db
					.update(tableKelas)
					.set(values)
					.where(and(eq(tableKelas.id, id), eq(tableKelas.sekolahId, sekolahId)));
				return { message: 'Kelas diperbarui.' };
			}
			await db.insert(tableKelas).values({ ...values, sekolahId, createdAt: now });
			return { message: 'Kelas ditambahkan.' };
		}
		case 'mata_pelajaran': {
			const kelasId = Number(teks(formData, 'kelas_id'));
			if (!kelasId) return { fail: 'Kelas wajib dipilih.' };
			const pengampuId = Number(teks(formData, 'pengampu_id')) || null;
			const values = {
				kelasId,
				nama: teks(formData, 'nama'),
				jenis: (teks(formData, 'jenis') || 'wajib') as
					'belum_dipetakan' | 'wajib' | 'pilihan' | 'mulok' | 'kejuruan' | 'pemberdayaan',
				kode: teks(formData, 'kode') || null,
				kkm: angkaAtau(formData, 'kkm', 0) ?? 0,
				urutan: angkaAtau(formData, 'urutan', null),
				pengampuId,
				updatedAt: now
			};
			if (id) {
				const kelasIds = (
					await db
						.select({ id: tableKelas.id })
						.from(tableKelas)
						.where(eq(tableKelas.sekolahId, sekolahId))
				).map((row) => row.id);
				if (!kelasIds.length) return { fail: 'Data tidak ditemukan di sekolah ini.' };
				await db
					.update(tableMataPelajaran)
					.set(values)
					.where(and(eq(tableMataPelajaran.id, id), inArray(tableMataPelajaran.kelasId, kelasIds)));
				return { message: 'Mata pelajaran diperbarui.' };
			}
			await db.insert(tableMataPelajaran).values({ ...values, createdAt: now });
			return { message: 'Mata pelajaran ditambahkan.' };
		}
		case 'pegawai': {
			const values = {
				nama: teks(formData, 'nama'),
				nip: teks(formData, 'nip'),
				nik: teks(formData, 'nik') || null,
				nuptk: teks(formData, 'nuptk') || null,
				dapodikPtkId: teks(formData, 'dapodik_ptk_id') || null,
				updatedAt: now
			};
			if (id) {
				await db
					.update(tablePegawai)
					.set(values)
					.where(and(eq(tablePegawai.id, id), eq(tablePegawai.sekolahId, sekolahId)));
				return { message: 'Data pegawai diperbarui.' };
			}
			await db.insert(tablePegawai).values({ ...values, sekolahId, createdAt: now });
			return { message: 'Data pegawai ditambahkan.' };
		}
		case 'sekolah': {
			const values = {
				nama: teks(formData, 'nama'),
				npsn: teks(formData, 'npsn'),
				email: teks(formData, 'email') || '-',
				website: teks(formData, 'website') || null,
				jenjangPendidikan: (teks(formData, 'jenjang_pendidikan') || 'sma') as
					'sd' | 'smp' | 'sma' | 'slb' | 'pkbm' | 'srt',
				jenjangVariant: teks(formData, 'jenjang_variant') || null,
				sumatifBobotLingkup: angkaAtau(formData, 'sumatif_bobot_lingkup', 60) ?? 60,
				sumatifBobotSts: angkaAtau(formData, 'sumatif_bobot_sts', 20) ?? 20,
				sumatifBobotSas: angkaAtau(formData, 'sumatif_bobot_sas', 20) ?? 20,
				sumatifBobotRtsLingkup: angkaAtau(formData, 'sumatif_bobot_rts_lingkup', 70) ?? 70,
				sumatifBobotRtsSts: angkaAtau(formData, 'sumatif_bobot_rts_sts', 30) ?? 30,
				raporKriteriaCukup: angkaAtau(formData, 'rapor_kriteria_cukup', 85) ?? 85,
				raporKriteriaBaik: angkaAtau(formData, 'rapor_kriteria_baik', 95) ?? 95,
				statusKepalaSekolah: (teks(formData, 'status_kepala_sekolah') || 'definitif') as
					'definitif' | 'plt',
				updatedAt: now
			};
			await db.update(tableSekolah).set(values).where(eq(tableSekolah.id, sekolahId));
			return { message: 'Profil & konfigurasi sekolah diperbarui.' };
		}
		default:
			return { fail: 'Jenis master data belum mendukung penyimpanan.' };
	}
}

/** Hapus data master data dengan pengaman terhadap data yang masih dipakai. */
export async function hapusMasterData(
	sekolahId: number,
	key: string,
	id: number
): Promise<HasilSimpan> {
	switch (key) {
		case 'tahun_ajaran': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableKelas)
				.where(eq(tableKelas.tahunAjaranId, id));
			if (n > 0) {
				return { fail: `Tahun ajaran masih dipakai ${n} kelas. Hapus kelasnya lebih dulu.` };
			}
			await db
				.delete(tableTahunAjaran)
				.where(and(eq(tableTahunAjaran.id, id), eq(tableTahunAjaran.sekolahId, sekolahId)));
			return { message: 'Tahun ajaran dihapus.' };
		}
		case 'semester': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableKelas)
				.where(eq(tableKelas.semesterId, id));
			if (n > 0) {
				return { fail: `Semester masih dipakai ${n} kelas. Hapus kelasnya lebih dulu.` };
			}
			await db.delete(tableSemester).where(eq(tableSemester.id, id));
			return { message: 'Semester dihapus.' };
		}
		case 'kelas': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableMurid)
				.where(eq(tableMurid.kelasId, id));
			if (n > 0) {
				return { fail: `Kelas masih memiliki ${n} murid. Pindahkan muridnya lebih dulu.` };
			}
			const [{ n: nMapel } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableMataPelajaran)
				.where(eq(tableMataPelajaran.kelasId, id));
			if (nMapel > 0) {
				return {
					fail: `Kelas masih memiliki ${nMapel} mata pelajaran. Hapus mapelnya lebih dulu.`
				};
			}
			await db
				.delete(tableKelas)
				.where(and(eq(tableKelas.id, id), eq(tableKelas.sekolahId, sekolahId)));
			return { message: 'Kelas dihapus.' };
		}
		case 'mata_pelajaran': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableAsesmenSumatif)
				.where(sql`asesmen_sumatif.mata_pelajaran_id = ${id}`);
			if (n > 0) {
				return { fail: `Mata pelajaran sudah memiliki ${n} nilai. Hapus nilainya lebih dulu.` };
			}
			await db.delete(tableMataPelajaran).where(eq(tableMataPelajaran.id, id));
			return { message: 'Mata pelajaran dihapus.' };
		}
		case 'pegawai': {
			const dipakaiKepala = await db
				.select({ id: tableSekolah.id })
				.from(tableSekolah)
				.where(eq(tableSekolah.kepalaSekolahId, id))
				.limit(1);
			if (dipakaiKepala.length) {
				return { fail: 'Guru ini adalah kepala sekolah. Ganti kepala sekolahnya lebih dulu.' };
			}
			const dipakaiKelas = await db
				.select({ id: tableKelas.id })
				.from(tableKelas)
				.where(eq(tableKelas.waliKelasId, id))
				.limit(1);
			if (dipakaiKelas.length) {
				return { fail: 'Guru masih menjadi wali kelas. Ganti wali kelasnya lebih dulu.' };
			}
			const dipakaiAsuh = await db
				.select({ id: tableKelas.id })
				.from(tableKelas)
				.where(eq(tableKelas.waliAsuhId, id))
				.limit(1);
			if (dipakaiAsuh.length) {
				return { fail: 'Guru masih menjadi wali asuh. Ganti wali asuhnya lebih dulu.' };
			}
			const dipakaiMapel = await db
				.select({ id: tableMataPelajaran.id })
				.from(tableMataPelajaran)
				.where(eq(tableMataPelajaran.pengampuId, id))
				.limit(1);
			if (dipakaiMapel.length) {
				return { fail: 'Guru masih mengampu mata pelajaran. Ganti pengampunya lebih dulu.' };
			}
			const dipakaiAkun = await db
				.select({ id: tableAuthUser.id })
				.from(tableAuthUser)
				.where(eq(tableAuthUser.pegawaiId, id))
				.limit(1);
			if (dipakaiAkun.length) {
				return { fail: 'Guru ini punya akun pengguna. Hapus atau ganti akunnya lebih dulu.' };
			}
			await db
				.delete(tablePegawai)
				.where(and(eq(tablePegawai.id, id), eq(tablePegawai.sekolahId, sekolahId)));
			return { message: 'Data pegawai dihapus.' };
		}
		case 'sekolah':
			return { fail: 'Data sekolah tidak bisa dihapus dari sini.' };
		default:
			return { fail: 'Jenis master data ini belum mendukung penghapusan.' };
	}
}
