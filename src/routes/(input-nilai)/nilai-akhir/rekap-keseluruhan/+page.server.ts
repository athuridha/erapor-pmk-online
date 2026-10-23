import { buildRekapKeseluruhan, daftarKelasSekolah } from '$lib/admin/rekap.server';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';
import { fail } from '@sveltejs/kit';
import { isAdminUser } from '../../../pengguna/permissions';

const PER_PAGE = 50;

/**
 * Rekap nilai keseluruhan: nilai murid lintas semester (dari kelas pertama
 * sampai kelas terakhir) lengkap dengan filter kelas, mata pelajaran, dan guru.
 */
export const load = async ({ parent, locals, url, depends }) => {
	depends('app:rekap-keseluruhan');
	const meta: PageMeta = { title: 'Rekap Nilai Keseluruhan' };
	const { kelasAktif } = await parent();
	const sekolahId = locals.sekolah?.id ?? null;
	const user = locals.user;

	if (!sekolahId) {
		return {
			meta,
			rekap: null,
			daftarKelas: [],
			statistik: null,
			filter: { kelasId: null, mapel: null, pengampuId: null },
			page: { q: null, currentPage: 1, totalPages: 1, totalItems: 0, perPage: PER_PAGE }
		};
	}

	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	let kelasId = Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : null;
	const adminScope = isAdminUser(user);

	// Non admin hanya boleh melihat kelas yang menjadi haknya.
	if (!adminScope) {
		if (kelasId && !(await canAccessKelas(user, sekolahId, kelasId))) {
			kelasId = null;
		}
		if (!kelasId) {
			const fallback = Number(kelasAktif?.id ?? 0);
			if (fallback > 0 && (await canAccessKelas(user, sekolahId, fallback))) {
				kelasId = fallback;
			}
		}
	}

	const filterMapel = url.searchParams.get('mapel')?.trim() || null;
	const paramPengampu = Number(url.searchParams.get('pengampu_id') ?? '');
	const pengampuId = Number.isInteger(paramPengampu) && paramPengampu > 0 ? paramPengampu : null;
	const search = url.searchParams.get('q')?.trim() || null;
	const perHalaman = normalisasiBarisPerHalaman(url.searchParams.get('per_page'), PER_PAGE);
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
	const totalPages = Math.max(1, Math.ceil(totalItems / perHalaman));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * perHalaman;

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
		rekap: { ...rekap, baris: baris.slice(offset, offset + perHalaman) },
		daftarKelas,
		statistik,
		filter: { kelasId, mapel: filterMapel, pengampuId },
		page: { q: search, currentPage, totalPages, totalItems, perPage: perHalaman }
	};
};

export const actions = {
	async pindahMurid({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		const user = locals.user;
		if (!user || !isAdminUser(user)) {
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
