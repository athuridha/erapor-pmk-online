import db from '$lib/server/db/index.js';
import { tableKelas, tableMurid } from '$lib/server/db/schema.js';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildKelasContext } from '$lib/server/route-utils';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';
import { isAuthorizedUser } from '../../pengguna/permissions';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';
import { runInChunks } from '$lib/server/db/chunk';

export async function load({ locals, url, depends, parent }) {
	depends('app:murid');
	const search = url.searchParams.get('q');
	const parentData = await parent();
	const { sekolahId, kelasId, kelasIds, academicContext } = await buildKelasContext(
		locals,
		parentData,
		url
	);

	// Target classes for bulk move, grouped by semester in the UI. Only classes
	// in the same semester as the selected students are accepted by the action.
	const kelasTujuan = sekolahId
		? (
				await db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true, semesterId: true },
					with: {
						semester: {
							columns: { id: true, nama: true },
							with: { tahunAjaran: { columns: { nama: true } } }
						}
					},
					where: eq(tableKelas.sekolahId, sekolahId),
					orderBy: [desc(tableKelas.semesterId), asc(tableKelas.nama)]
				})
			).map((kelas) => ({
				id: kelas.id,
				nama: kelas.nama,
				fase: kelas.fase,
				semesterId: kelas.semesterId,
				semesterNama: kelas.semester?.nama ?? '',
				tahunAjaranNama: kelas.semester?.tahunAjaran?.nama ?? ''
			}))
		: [];
	const perPage = normalisasiBarisPerHalaman(url.searchParams.get('per_page'), 50);
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	const statusParam = url.searchParams.get('status') || 'aktif';
	const statusFilter =
		statusParam && statusParam !== 'semua'
			? eq(tableMurid.status, statusParam as 'aktif' | 'lulus' | 'pindah' | 'keluar')
			: undefined;

	if (!sekolahId || !kelasIds.length) {
		return {
			daftarMurid: [],
			academicContext,
			kelasTujuan,
			statusCounts: { aktif: 0, keluar: 0, pindah: 0, lulus: 0, semua: 0 },
			page: {
				kelasId,
				search,
				status: statusParam,
				currentPage: 1,
				totalPages: 1,
				totalItems: 0,
				perPage
			}
		};
	}

	const baseClassFilter = and(
		eq(tableMurid.sekolahId, sekolahId),
		kelasId ? eq(tableMurid.kelasId, +kelasId) : inArray(tableMurid.kelasId, kelasIds)
	);

	const filter = and(
		baseClassFilter,
		search ? sql`${tableMurid.nama} LIKE ${'%' + search + '%'} COLLATE NOCASE` : undefined,
		statusFilter
	);

	const [statusCountsRaw, [{ totalItems }]] = await Promise.all([
		db
			.select({ status: tableMurid.status, count: sql<number>`count(*)` })
			.from(tableMurid)
			.where(baseClassFilter)
			.groupBy(tableMurid.status),
		db
			.select({ totalItems: sql<number>`count(*)` })
			.from(tableMurid)
			.where(filter)
	]);

	const countsMap: Record<string, number> = { aktif: 0, keluar: 0, pindah: 0, lulus: 0 };
	let totalSemua = 0;
	for (const row of statusCountsRaw) {
		const s = row.status ?? 'aktif';
		countsMap[s] = row.count;
		totalSemua += row.count;
	}
	countsMap.semua = totalSemua;

	const total = totalItems ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * perPage;

	const daftarMurid = await db.query.tableMurid.findMany({
		where: filter,
		columns: {
			id: true,
			nama: true,
			nis: true,
			nisn: true,
			agama: true,
			tempatLahir: true,
			tanggalLahir: true,
			status: true,
			tanggalKeluar: true,
			alasanKeluar: true
		},
		orderBy: asc(tableMurid.nama),
		limit: perPage,
		offset
	});

	if (pageNumber !== currentPage) {
		const params = new URLSearchParams(url.searchParams);
		if (currentPage <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(currentPage));
		}
		throw redirect(303, `${url.pathname}${params.size ? `?${params}` : ''}`);
	}

	return {
		daftarMurid,
		academicContext,
		kelasTujuan,
		statusCounts: countsMap,
		page: {
			kelasId,
			search,
			status: statusParam,
			currentPage,
			totalPages,
			totalItems: total,
			perPage
		}
	};
}

export const actions = {
	async deleteSelected({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}

		const formData = await request.formData();
		const rawIds = formData.getAll('muridIds');
		const muridIds = rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);

		if (!muridIds.length) {
			return fail(400, { fail: 'Pilih minimal satu murid untuk dihapus' });
		}

		await runInChunks(muridIds, (ids) =>
			db
				.delete(tableMurid)
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
		);

		return { message: `${muridIds.length} murid berhasil dihapus` };
	},

	async pindahMurid({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin memindahkan murid' });
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
	},

	async keluarkanMurid({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan' });
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin mengelola murid' });
		}

		const formData = await request.formData();
		const muridId = Number(formData.get('muridId'));
		const tanggalKeluar =
			formData.get('tanggalKeluar')?.toString() || new Date().toISOString().split('T')[0];
		const alasanKeluar =
			formData.get('alasanKeluar')?.toString()?.trim() || 'Dikeluarkan oleh pihak sekolah';

		if (!Number.isInteger(muridId) || muridId <= 0) {
			return fail(400, { fail: 'Data murid tidak valid' });
		}

		await db
			.update(tableMurid)
			.set({
				status: 'keluar',
				tanggalKeluar,
				alasanKeluar
			})
			.where(and(eq(tableMurid.id, muridId), eq(tableMurid.sekolahId, sekolahId)));

		return { message: 'Murid berhasil dikeluarkan dari sekolah.' };
	},

	async aktifkanMurid({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan' });
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin mengelola murid' });
		}

		const formData = await request.formData();
		const muridId = Number(formData.get('muridId'));
		if (!Number.isInteger(muridId) || muridId <= 0) {
			return fail(400, { fail: 'Data murid tidak valid' });
		}

		await db
			.update(tableMurid)
			.set({
				status: 'aktif',
				tanggalKeluar: null,
				alasanKeluar: null
			})
			.where(and(eq(tableMurid.id, muridId), eq(tableMurid.sekolahId, sekolahId)));

		return { message: 'Status murid berhasil diaktifkan kembali.' };
	},

	async keluarkanBulk({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan' });
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin mengelola murid' });
		}

		const formData = await request.formData();
		const rawIds = formData.getAll('muridIds');
		const muridIds = rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
		if (!muridIds.length) {
			return fail(400, { fail: 'Pilih minimal satu murid' });
		}

		const tanggalKeluar =
			formData.get('tanggalKeluar')?.toString() || new Date().toISOString().split('T')[0];
		const alasanKeluar =
			formData.get('alasanKeluar')?.toString()?.trim() || 'Dikeluarkan oleh pihak sekolah';

		await db
			.update(tableMurid)
			.set({
				status: 'keluar',
				tanggalKeluar,
				alasanKeluar
			})
			.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, muridIds)));

		return { message: `${muridIds.length} murid berhasil dikeluarkan.` };
	}
};
