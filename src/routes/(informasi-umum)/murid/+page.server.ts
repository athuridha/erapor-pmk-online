import db from '$lib/server/db/index.js';
import { tableKelas, tableMurid } from '$lib/server/db/schema.js';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildKelasContext } from '$lib/server/route-utils';
import { pindahkanMuridKelas } from '$lib/server/murid-pindah-kelas';
import { isAuthorizedUser } from '../../pengguna/permissions';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';
import { queryInChunks, runInChunks } from '$lib/server/db/chunk';

/** ID unik dari form (hindari duplikat & nilai tidak valid). */
function parseMuridIds(formData: FormData, key = 'muridIds'): number[] {
	return [
		...new Set(
			formData
				.getAll(key)
				.map((id) => Number(id))
				.filter((id) => Number.isInteger(id) && id > 0)
		)
	];
}

/** Urutan fase untuk validasi kenaikan kelas (E → F). */
function faseKeAngka(fase: string | null | undefined): number | null {
	const huruf = (fase ?? '').trim().replace(/^fase\s+/i, '').toUpperCase();
	if (!/^[A-Z]$/.test(huruf)) return null;
	return huruf.charCodeAt(0) - 'A'.charCodeAt(0);
}

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
		// Kolom identitas (kelas & nama ayah) ikut dimuat supaya halaman ini bisa
		// menjadi satu-satunya daftar murid: identitas lengkap + aksi lengkap.
		with: {
			kelas: { columns: { id: true, nama: true, fase: true } },
			ayah: { columns: { nama: true } }
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
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin menghapus murid' });
		}

		const formData = await request.formData();
		const muridIds = parseMuridIds(formData);
		if (!muridIds.length) {
			return fail(400, { fail: 'Pilih minimal satu murid untuk dihapus' });
		}

		let terhapus = 0;
		await runInChunks(muridIds, async (ids) => {
			const rows = await db
				.delete(tableMurid)
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
				.returning({ id: tableMurid.id });
			terhapus += rows.length;
		});

		if (!terhapus) {
			return fail(400, { fail: 'Tidak ada murid milik sekolah ini yang terhapus.' });
		}
		const dilewati = muridIds.length - terhapus;
		return {
			message: `${terhapus} murid dihapus${
				dilewati ? `, ${dilewati} dilewati (tidak ditemukan)` : ''
			}.`
		};
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
		const muridIds = parseMuridIds(formData);
		const kelasId = Number(formData.get('kelasId'));

		const hasil = await pindahkanMuridKelas({ sekolahId, muridIds, kelasId });
		if (!hasil.fail) {
			return { message: hasil.message };
		}

		// Sebagian data bisa gagal (mis. murid beda semester). Coba per murid
		// agar yang valid tetap pindah, lalu laporkan jumlah berhasil/gagal.
		let berhasil = 0;
		const gagal: Array<{ id: number; alasan: string }> = [];
		for (const id of muridIds) {
			const satu = await pindahkanMuridKelas({ sekolahId, muridIds: [id], kelasId });
			if (satu.fail) gagal.push({ id, alasan: satu.fail });
			else berhasil += 1;
		}
		if (!berhasil) {
			return fail(400, {
				fail: `${hasil.fail} (${gagal.length} murid gagal dipindahkan)`
			});
		}
		return {
			message: `${berhasil} murid dipindahkan, ${gagal.length} gagal${
				gagal.length ? ` (contoh: ${gagal[0].alasan})` : ''
			}.`
		};
	},

	/**
	 * Naik kelas massal: pindahkan murid terpilih ke kelas tujuan yang fasenya
	 * lebih tinggi (mis. Fase E → Fase F). Tiap murid divalidasi sendiri supaya
	 * satu kegagalan tidak membatalkan seluruh proses; hasil dilaporkan jumlah.
	 */
	async naikKelas({ request, locals }) {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah tidak ditemukan' });
		if (!isAuthorizedUser(['informasi_umum_murid'], locals.user ?? undefined)) {
			return fail(403, { fail: 'Anda tidak memiliki izin memindahkan murid' });
		}

		const formData = await request.formData();
		const muridIds = parseMuridIds(formData);
		const kelasId = Number(formData.get('kelasId'));
		if (!muridIds.length) return fail(400, { fail: 'Pilih minimal satu murid.' });
		if (!Number.isInteger(kelasId) || kelasId <= 0) {
			return fail(400, { fail: 'Pilih kelas tujuan kenaikan kelas.' });
		}

		const kelasTujuan = await db.query.tableKelas.findFirst({
			columns: { id: true, nama: true, fase: true, semesterId: true },
			where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
		});
		if (!kelasTujuan) return fail(400, { fail: 'Kelas tujuan tidak ditemukan di sekolah ini.' });

		const muridRows = await queryInChunks(muridIds, async (ids) =>
			db
				.select({
					id: tableMurid.id,
					nama: tableMurid.nama,
					kelasId: tableMurid.kelasId,
					semesterId: tableMurid.semesterId
				})
				.from(tableMurid)
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
		);

		const kelasAsalIds = [...new Set(muridRows.map((row) => row.kelasId).filter(Boolean))];
		const kelasAsal = kelasAsalIds.length
			? await queryInChunks(kelasAsalIds as number[], async (ids) =>
					db
						.select({ id: tableKelas.id, fase: tableKelas.fase })
						.from(tableKelas)
						.where(and(eq(tableKelas.sekolahId, sekolahId), inArray(tableKelas.id, ids)))
				)
			: [];
		const faseAsalMap = new Map(kelasAsal.map((row) => [row.id, row.fase]));
		const faseTujuan = faseKeAngka(kelasTujuan.fase);

		let berhasil = 0;
		const gagal: Array<{ nama: string; alasan: string }> = [];
		const now = new Date().toISOString();

		for (const murid of muridRows) {
			const faseAsal = faseKeAngka(faseAsalMap.get(murid.kelasId));
			if (murid.kelasId === kelasTujuan.id) {
				gagal.push({ nama: murid.nama, alasan: 'sudah di kelas tujuan' });
				continue;
			}
			if (faseAsal != null && faseTujuan != null && faseTujuan <= faseAsal) {
				gagal.push({
					nama: murid.nama,
					alasan: `fase tujuan (${kelasTujuan.fase}) bukan fase berikutnya`
				});
				continue;
			}
			try {
				await db
					.update(tableMurid)
					.set({
						kelasId: kelasTujuan.id,
						semesterId: kelasTujuan.semesterId,
						updatedAt: now
					})
					.where(and(eq(tableMurid.id, murid.id), eq(tableMurid.sekolahId, sekolahId)));
				berhasil += 1;
			} catch (error) {
				console.error('[murid] naik kelas gagal', error);
				gagal.push({ nama: murid.nama, alasan: 'gagal menyimpan' });
			}
		}

		const takDitemukan = muridIds.length - muridRows.length;
		const sisaPesan = [
			gagal.length
				? `${gagal.length} gagal (contoh: ${gagal[0].nama} — ${gagal[0].alasan})`
				: '',
			takDitemukan ? `${takDitemukan} tidak ditemukan` : ''
		]
			.filter(Boolean)
			.join(', ');

		if (!berhasil) {
			return fail(400, {
				fail: `Kenaikan kelas gagal${sisaPesan ? ` — ${sisaPesan}` : ''}.`
			});
		}
		return {
			message: `${berhasil} murid naik ke kelas ${kelasTujuan.nama}${
				sisaPesan ? `, ${sisaPesan}` : ''
			}.`
		};
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
		const muridIds = parseMuridIds(formData);
		if (!muridIds.length) {
			return fail(400, { fail: 'Pilih minimal satu murid' });
		}

		const tanggalKeluar =
			formData.get('tanggalKeluar')?.toString() || new Date().toISOString().split('T')[0];
		const alasanKeluar =
			formData.get('alasanKeluar')?.toString()?.trim() || 'Dikeluarkan oleh pihak sekolah';

		let diubah = 0;
		await runInChunks(muridIds, async (ids) => {
			const rows = await db
				.update(tableMurid)
				.set({
					status: 'keluar',
					tanggalKeluar,
					alasanKeluar
				})
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
				.returning({ id: tableMurid.id });
			diubah += rows.length;
		});

		if (!diubah) return fail(400, { fail: 'Tidak ada murid yang dikeluarkan.' });
		const dilewati = muridIds.length - diubah;
		return {
			message: `${diubah} murid berhasil dikeluarkan${
				dilewati ? `, ${dilewati} dilewati` : ''
			}.`
		};
	}
};
