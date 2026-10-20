import { KELOMPOK_MODUL, modulAdmin, type ModulAdmin } from '$lib/admin-modul';
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
	tablePresensiGuru,
	tableSppd,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { count, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { buildRekapKeseluruhan, daftarKelasSekolah } from '$lib/server/rekap-keseluruhan';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';

const PER_PAGE = 50;

export interface ModulDenganJumlah extends ModulAdmin {
	jumlah: number | null;
}

/**
 * Dashboard khusus admin: pusat pengelolaan (CRUD) seluruh data sekolah
 * sekaligus ringkasan rekap nilai lintas semester.
 */
export const load = async ({ locals, url, depends }) => {
	depends('app:dashboard-admin');
	const meta: PageMeta = { title: 'Dashboard Admin' };
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Dashboard ini khusus admin dan kepala sekolah.');
	}

	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	const kelasId = Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : null;
	const filterMapel = url.searchParams.get('mapel')?.trim() || null;
	const paramPengampu = Number(url.searchParams.get('pengampu_id') ?? '');
	const pengampuId = Number.isInteger(paramPengampu) && paramPengampu > 0 ? paramPengampu : null;
	const search = url.searchParams.get('q')?.trim() || null;
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	const rekap = await buildRekapKeseluruhan(sekolahId, { kelasId, filterMapel, pengampuId });
	const daftarKelas = await daftarKelasSekolah(sekolahId);
	const kelasIds = daftarKelas.map((kelas) => kelas.id);

	// Jumlah data tiap modul — semua dibaca langsung dari database.
	const [{ n: nTahunAjaran } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableTahunAjaran)
		.where(eq(tableTahunAjaran.sekolahId, sekolahId));
	const [{ n: nKelas } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableKelas)
		.where(eq(tableKelas.sekolahId, sekolahId));
	const [{ n: nMurid } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableMurid)
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nMapel } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableMataPelajaran)
		.where(kelasIds.length ? inArray(tableMataPelajaran.kelasId, kelasIds) : undefined);
	const [{ n: nKokurikuler } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableKokurikuler)
		.where(kelasIds.length ? inArray(tableKokurikuler.kelasId, kelasIds) : undefined);
	const [{ n: nEkstrakurikuler } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableEkstrakurikuler)
		.where(kelasIds.length ? inArray(tableEkstrakurikuler.kelasId, kelasIds) : undefined);
	const [{ n: nPengguna } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableAuthUser)
		.where(or(eq(tableAuthUser.sekolahId, sekolahId), eq(tableAuthUser.type, 'admin')));
	const [{ n: nFormatif } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableAsesmenFormatif)
		.innerJoin(tableMurid, eq(tableAsesmenFormatif.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nSumatif } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableAsesmenSumatif)
		.innerJoin(tableMurid, eq(tableAsesmenSumatif.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nKokNilai } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableAsesmenKokurikuler)
		.innerJoin(tableMurid, eq(tableAsesmenKokurikuler.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nEksNilai } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableAsesmenEkstrakurikuler)
		.innerJoin(tableMurid, eq(tableAsesmenEkstrakurikuler.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nKehadiran } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableKehadiranMurid)
		.innerJoin(tableMurid, eq(tableKehadiranMurid.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nPresensiGuru } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tablePresensiGuru)
		.where(eq(tablePresensiGuru.sekolahId, sekolahId));
	const [{ n: nJadwal } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableJadwalPelajaran)
		.where(eq(tableJadwalPelajaran.sekolahId, sekolahId));
	const [{ n: nJurnal } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableJurnalMengajar)
		.innerJoin(tableKelas, eq(tableJurnalMengajar.kelasId, tableKelas.id))
		.where(eq(tableKelas.sekolahId, sekolahId));
	const [{ n: nCatatan } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableCatatanWaliKelas)
		.innerJoin(tableMurid, eq(tableCatatanWaliKelas.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nKeputusan } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableKeputusanMurid)
		.innerJoin(tableMurid, eq(tableKeputusanMurid.muridId, tableMurid.id))
		.where(eq(tableMurid.sekolahId, sekolahId));
	const [{ n: nTandaTangan } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tablePegawai)
		.where(isNotNull(tablePegawai.tandaTangan));
	const [{ n: nSppd } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableSppd)
		.where(eq(tableSppd.sekolahId, sekolahId));
	const [{ n: nDinasLuar } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableDinasLuarPermohonan)
		.where(eq(tableDinasLuarPermohonan.sekolahId, sekolahId));
	const [{ n: nBukuTamu } = { n: 0 }] = await db
		.select({ n: count() })
		.from(tableBukuTamu)
		.where(eq(tableBukuTamu.sekolahId, sekolahId));

	const jumlah: Record<string, number | null> = {
		sekolah: 1,
		tahun_ajaran: nTahunAjaran,
		akademik: null,
		kelas: nKelas,
		murid: nMurid,
		intrakurikuler: nMapel,
		kokurikuler: nKokurikuler,
		ekstrakurikuler: nEkstrakurikuler,
		pengguna: nPengguna,
		asesmen_formatif: nFormatif,
		asesmen_sumatif: nSumatif,
		asesmen_kokurikuler: nKokNilai,
		nilai_ekstrakurikuler: nEksNilai,
		nilai_akhir: null,
		rekap_keseluruhan: null,
		presensi_murid: nKehadiran,
		presensi_guru: nPresensiGuru,
		jadwal: nJadwal,
		jurnal: nJurnal,
		catatan_wali: nCatatan,
		keputusan: nKeputusan,
		tanda_tangan: nTandaTangan,
		portal: null,
		sinkronisasi: null,
		cetak: null,
		sppd: nSppd,
		dinas_luar: nDinasLuar,
		buku_tamu: nBukuTamu,
		pengaturan: null
	};

	const modul: ModulDenganJumlah[] = modulAdmin.map((item) => ({
		...item,
		jumlah: jumlah[item.key] ?? null
	}));

	let baris = rekap.baris;
	if (search) {
		const keyword = search.toLowerCase();
		baris = baris.filter(
			(row) =>
				row.nama.toLowerCase().includes(keyword) ||
				row.nis.toLowerCase().includes(keyword) ||
				row.nisn.toLowerCase().includes(keyword)
		);
	}
	const totalItems = baris.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * PER_PAGE;

	const jumlahNilai = rekap.rekapMapel.reduce((total, item) => total + item.jumlahNilai, 0);
	const totalNilai = rekap.rekapMapel.reduce(
		(total, item) => total + (item.rataRata ?? 0) * item.jumlahNilai,
		0
	);

	const statistik = {
		totalMurid: rekap.totalMurid,
		muridSudahNilai: rekap.totalDinilai,
		muridBelumNilai: Math.max(0, rekap.totalMurid - rekap.totalDinilai),
		totalKelas: daftarKelas.length,
		totalMapel: rekap.daftarMapel.length,
		totalGuru: rekap.daftarGuru.length,
		totalSemester: rekap.semester.length,
		jumlahNilai,
		rataRataKeseluruhan: jumlahNilai > 0 ? Math.round((totalNilai / jumlahNilai) * 100) / 100 : null
	};

	return {
		meta,
		modul,
		kelompok: KELOMPOK_MODUL,
		rekap: { ...rekap, baris: baris.slice(offset, offset + PER_PAGE) },
		daftarKelas,
		filter: { kelasId, mapel: filterMapel, pengampuId },
		statistik,
		page: { q: search, currentPage, totalPages, totalItems, perPage: PER_PAGE }
	};
};

export const actions = {
	async moveSelected({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang bisa memindahkan murid' });
		}

		const formData = await request.formData();
		const muridIds = [
			...new Set(
				formData
					.getAll('muridIds')
					.map((id) => Number(id))
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		];
		const kelasId = Number(formData.get('kelasId'));

		const hasil = await pindahkanMuridKelas({ sekolahId, muridIds, kelasId });
		if (hasil.fail) {
			return fail(400, { fail: hasil.fail });
		}
		return { message: hasil.message };
	}
};
