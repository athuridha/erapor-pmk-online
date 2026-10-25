import db from '$lib/server/db';
import { ensureCatatanWaliSchema } from '$lib/server/db/ensure-catatan-wali';
import { tableCatatanWaliKelas, tableMurid, tableKelas } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { buildKelasContext } from '$lib/server/route-utils';
import { isWaliKelasAccount } from '$lib/server/kelas-akses';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';

export async function load({ locals, url, depends, parent }) {
	depends('app:catatan-wali-kelas');
	await ensureCatatanWaliSchema();

	const parentData = await parent();
	const { sekolahId, kelasId, kelasIds, academicContext } = await buildKelasContext(
		locals,
		parentData,
		url
	);
	const searchRaw = url.searchParams.get('q')?.trim() ?? '';
	const search = searchRaw || null;
	const perPage = normalisasiBarisPerHalaman(url.searchParams.get('per_page'), 50);
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	if (!sekolahId || !kelasIds.length) {
		return {
			meta: { title: 'Catatan Wali Kelas' },
			academicContext,
			daftarCatatan: [],
			page: {
				kelasId,
				search,
				currentPage: 1,
				totalPages: 1,
				totalItems: 0,
				perPage
			}
		};
	}

	const filter = and(
		eq(tableMurid.sekolahId, sekolahId),
		kelasId ? eq(tableMurid.kelasId, Number(kelasId)) : inArray(tableMurid.kelasId, kelasIds),
		search ? sql`${tableMurid.nama} LIKE ${'%' + search + '%'} COLLATE NOCASE` : undefined
	);

	const [{ totalItems }] = await db
		.select({ totalItems: sql<number>`count(*)` })
		.from(tableMurid)
		.where(filter);

	const total = totalItems ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * perPage;

	if (pageNumber !== currentPage) {
		const params = new URLSearchParams(url.searchParams);
		if (currentPage <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(currentPage));
		}
		throw redirect(303, `${url.pathname}${params.size ? `?${params}` : ''}`);
	}

	const rows = await db
		.select({
			id: tableMurid.id,
			nama: tableMurid.nama,
			catatan: tableCatatanWaliKelas.catatan,
			updatedAt: tableCatatanWaliKelas.updatedAt
		})
		.from(tableMurid)
		.leftJoin(tableCatatanWaliKelas, eq(tableMurid.id, tableCatatanWaliKelas.muridId))
		.where(filter)
		.orderBy(asc(tableMurid.nama))
		.limit(perPage)
		.offset(offset);

	const daftarCatatan = rows.map((row, index) => ({
		id: row.id,
		nama: row.nama,
		catatan: row.catatan ?? null,
		updatedAt: row.updatedAt,
		no: offset + index + 1
	}));

	return {
		meta: { title: 'Catatan Wali Kelas' },
		academicContext,
		daftarCatatan,
		page: {
			kelasId,
			search,
			currentPage,
			totalPages,
			totalItems: total,
			perPage
		}
	};
}

export const actions = {
	save: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}

		// Permission check: admin/kepala_sekolah, atau wali kelas — termasuk guru
		// merangkap wali kelas (tipe 'user' dengan relasi waliKelasId).
		const saveUserType = (locals.user as { type?: string } | null)?.type;
		const saveIsStaff = saveUserType === 'admin' || saveUserType === 'kepala_sekolah';
		if (!saveIsStaff && !(await isWaliKelasAccount(locals.user))) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menulis catatan wali kelas.' });
		}

		await ensureCatatanWaliSchema();

		const formData = await request.formData();
		const muridIdRaw = formData.get('muridId');
		const catatanRaw = formData.get('catatan');

		const muridId = Number(muridIdRaw);
		if (!Number.isInteger(muridId) || muridId <= 0) {
			return fail(400, { fail: 'Data murid tidak valid' });
		}

		const murid = await db.query.tableMurid.findFirst({
			columns: { id: true, kelasId: true },
			where: and(eq(tableMurid.id, muridId), eq(tableMurid.sekolahId, sekolahId))
		});

		if (!murid) {
			return fail(404, { fail: 'Murid tidak ditemukan' });
		}

		// Wali kelas (tipe legacy maupun guru-wali) diverifikasi terhadap kelas murid.
		if (!saveIsStaff) {
			const pegawaiId = (locals.user as { pegawaiId?: number | null }).pegawaiId;
			if (!pegawaiId) {
				return fail(403, { fail: 'Data wali kelas tidak lengkap.' });
			}
			const kelas = await db.query.tableKelas.findFirst({
				columns: { id: true, waliKelasId: true },
				where: eq(tableKelas.id, murid.kelasId)
			});
			if (!kelas || kelas.waliKelasId !== pegawaiId) {
				return fail(403, { fail: 'Anda bukan wali kelas dari murid ini.' });
			}
		}

		const catatanValue = typeof catatanRaw === 'string' ? catatanRaw : '';
		const trimmed = catatanValue.trim();
		const now = new Date().toISOString();

		if (!trimmed) {
			await db.delete(tableCatatanWaliKelas).where(eq(tableCatatanWaliKelas.muridId, muridId));
			return { message: 'Catatan dihapus' };
		}

		await db
			.insert(tableCatatanWaliKelas)
			.values({
				muridId,
				catatan: catatanValue,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: tableCatatanWaliKelas.muridId,
				set: {
					catatan: catatanValue,
					updatedAt: now
				}
			});

		return { message: 'Catatan tersimpan' };
	},
	fillAll: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}

		// Permission check: admin/kepala_sekolah, atau wali kelas — termasuk guru
		// merangkap wali kelas (tipe 'user' dengan relasi waliKelasId).
		const fillUserType = (locals.user as { type?: string } | null)?.type;
		const fillIsStaff = fillUserType === 'admin' || fillUserType === 'kepala_sekolah';
		if (!fillIsStaff && !(await isWaliKelasAccount(locals.user))) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menulis catatan wali kelas.' });
		}

		await ensureCatatanWaliSchema();

		const formData = await request.formData();
		const muridIdsRaw = formData.get('muridIds');
		const catatanRaw = formData.get('catatan');

		if (typeof muridIdsRaw !== 'string') {
			return fail(400, { fail: 'Daftar murid tidak valid' });
		}

		let parsedIds: unknown;
		try {
			parsedIds = JSON.parse(muridIdsRaw);
		} catch (error) {
			console.error('Gagal mengurai muridIds', error);
			return fail(400, { fail: 'Format daftar murid tidak valid' });
		}

		const muridIds = Array.isArray(parsedIds)
			? parsedIds
					.map((value) => Number(value))
					.filter((value) => Number.isInteger(value) && value > 0)
			: [];

		if (!muridIds.length) {
			return fail(400, { fail: 'Tidak ada murid yang dipilih' });
		}

		// Wali kelas (tipe legacy maupun guru-wali) diverifikasi terhadap kelas semua murid terpilih.
		if (!fillIsStaff) {
			const pegawaiId = (locals.user as { pegawaiId?: number | null }).pegawaiId;
			if (!pegawaiId) {
				return fail(403, { fail: 'Data wali kelas tidak lengkap.' });
			}
			const fillMuridList = await db
				.select({ id: tableMurid.id, kelasId: tableMurid.kelasId })
				.from(tableMurid)
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, muridIds)));
			const uniqueKelasIds = new Set(fillMuridList.map((m) => m.kelasId));
			for (const kId of uniqueKelasIds) {
				const kelasRow = await db.query.tableKelas.findFirst({
					columns: { id: true, waliKelasId: true },
					where: eq(tableKelas.id, kId)
				});
				if (!kelasRow || kelasRow.waliKelasId !== pegawaiId) {
					return fail(403, { fail: 'Anda bukan wali kelas dari salah satu murid yang dipilih.' });
				}
			}
		}

		const muridList = await db
			.select({ id: tableMurid.id })
			.from(tableMurid)
			.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, muridIds)));

		const validIds = muridList.map((item) => item.id);
		if (!validIds.length) {
			return fail(404, { fail: 'Murid tidak ditemukan' });
		}

		const catatanValue = typeof catatanRaw === 'string' ? catatanRaw : '';
		const trimmed = catatanValue.trim();
		const now = new Date().toISOString();

		if (!trimmed) {
			await db
				.delete(tableCatatanWaliKelas)
				.where(inArray(tableCatatanWaliKelas.muridId, validIds));
			return { message: `Catatan dihapus untuk ${validIds.length} murid` };
		}

		const payload = validIds.map((id) => ({
			muridId: id,
			catatan: catatanValue,
			updatedAt: now
		}));

		await db
			.insert(tableCatatanWaliKelas)
			.values(payload)
			.onConflictDoUpdate({
				target: tableCatatanWaliKelas.muridId,
				set: {
					catatan: catatanValue,
					updatedAt: now
				}
			});

		return { message: `Catatan diterapkan ke ${validIds.length} murid` };
	}
};
