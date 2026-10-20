import { buildRekapKeseluruhan, daftarKelasSekolah } from '$lib/server/rekap-keseluruhan';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';
import { fail } from '@sveltejs/kit';

const PER_PAGE = 50;

export const load = async ({ parent, locals, url, depends }) => {
	depends('app:nilai-akhir-rekap-keseluruhan');
	const meta: PageMeta = { title: 'Rekap Nilai Keseluruhan' };
	const { kelasAktif } = await parent();
	const sekolahId = locals.sekolah?.id ?? null;

	if (!sekolahId) {
		return {
			meta,
			rekap: null,
			daftarKelas: [],
			daftarMapel: [],
			daftarGuru: [],
			page: { q: null, currentPage: 1, totalPages: 1, totalItems: 0, perPage: PER_PAGE }
		};
	}

	const user = locals.user;
	const tanpaBatasan = user?.type === 'admin' || user?.type === 'kepala_sekolah';

	// Admin & kepala sekolah: seluruh murid sekolah (utamanya). Wali kelas/guru:
	// kelas yang boleh diaksesnya saja.
	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	let targetKelasId: number | null =
		Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : null;
	if (targetKelasId && !(await canAccessKelas(user, sekolahId, targetKelasId))) {
		targetKelasId = null;
	}
	if (!tanpaBatasan && !targetKelasId) {
		const fallback = Number(kelasAktif?.id ?? 0);
		if (fallback > 0 && (await canAccessKelas(user, sekolahId, fallback))) {
			targetKelasId = fallback;
		}
	}

	const filterMapel = url.searchParams.get('mapel')?.trim() || null;
	const paramPengampu = Number(url.searchParams.get('pengampu_id') ?? '');
	const pengampuId = Number.isInteger(paramPengampu) && paramPengampu > 0 ? paramPengampu : null;

	const search = url.searchParams.get('q')?.trim() || null;
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	const rekap = await buildRekapKeseluruhan(sekolahId, {
		kelasId: targetKelasId,
		filterMapel,
		pengampuId
	});

	const semuaKelas = await daftarKelasSekolah(sekolahId);
	const daftarKelas = tanpaBatasan
		? semuaKelas
		: (
				await Promise.all(
					semuaKelas.map(async (kelas) => ({
						kelas,
						boleh: await canAccessKelas(user, sekolahId, kelas.id)
					}))
				)
			)
				.filter((item) => item.boleh)
				.map((item) => item.kelas);

	// Pencarian + pagination di sisi server karena cakupannya bisa ratusan murid.
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

	return {
		meta,
		rekap: { ...rekap, baris: baris.slice(offset, offset + PER_PAGE) },
		daftarKelas,
		daftarMapel: rekap.daftarMapel,
		daftarGuru: rekap.daftarGuru,
		filter: { kelasId: targetKelasId, mapel: filterMapel, pengampuId },
		page: { q: search, currentPage, totalPages, totalItems, perPage: PER_PAGE }
	};
};

export const actions = {
	async moveSelected({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		if (!locals.user) {
			return fail(401, { fail: 'Sesi tidak valid. Silakan login ulang.' });
		}
		if (locals.user.type !== 'admin' && locals.user.type !== 'kepala_sekolah') {
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
