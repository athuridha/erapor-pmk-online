import { buildRekapKeseluruhan, daftarKelasSekolah } from '$lib/server/rekap-keseluruhan';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';
import { error, fail } from '@sveltejs/kit';

const PER_PAGE = 50;

/**
 * Dashboard khusus admin: ringkasan seluruh murid, mata pelajaran, dan guru
 * sekolah beserta rekap nilai lintas semester.
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
	const rataRataKeseluruhan = jumlahNilai > 0 ? totalNilai / jumlahNilai : null;

	const statistik = {
		totalMurid: rekap.totalMurid,
		muridSudahNilai: rekap.totalDinilai,
		muridBelumNilai: Math.max(0, rekap.totalMurid - rekap.totalDinilai),
		totalKelas: daftarKelas.length,
		totalMapel: rekap.daftarMapel.length,
		totalGuru: rekap.daftarGuru.length,
		totalSemester: rekap.semester.length,
		jumlahNilai,
		rataRataKeseluruhan:
			rataRataKeseluruhan == null ? null : Math.round(rataRataKeseluruhan * 100) / 100
	};

	return {
		meta,
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
