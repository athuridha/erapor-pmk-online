import db from '$lib/server/db';
import { isWaliKelasAccount, kelasKontenSet, ownedKelasIdSet } from '$lib/server/kelas-akses';
import { tableKokurikuler, tableMataPelajaran, tablePegawai } from '$lib/server/db/schema';
import { profilPelajarPancasilaDimensions, type DimensiProfilLulusanKey } from '$lib/statics';
import { fail } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { readBufferToAoA } from '$lib/utils/excel.js';
import { cookieNames } from '$lib/utils';
import { isAdminUser } from '../../pengguna/permissions';

const DIMENSION_KEY_SET = new Set<DimensiProfilLulusanKey>(
	profilPelajarPancasilaDimensions.map((dimension) => dimension.key)
);

const TABLE_MISSING_MESSAGE =
	'Tabel kokurikuler belum tersedia. Jalankan "pnpm db:push" untuk menerapkan migrasi terbaru.';

function sanitizeDimensions(values: string[]): DimensiProfilLulusanKey[] {
	const unique = new Set<DimensiProfilLulusanKey>();
	for (const value of values) {
		if (DIMENSION_KEY_SET.has(value as DimensiProfilLulusanKey)) {
			unique.add(value as DimensiProfilLulusanKey);
		}
	}
	return Array.from(unique);
}

function isTableMissingError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes('no such table') &&
		error.message.includes('kokurikuler')
	);
}

export async function load({ depends, parent, locals, url }) {
	depends('app:kokurikuler');
	const { kelasAktif, daftarKelas, sekolah } = await parent();
	const kelasId = kelasAktif?.id ?? null;
	// Admin di mode "Semua Kelas" tidak punya kelas aktif; tampilkan semua kelas
	// dan biarkan kelas dipilih langsung di form.
	const semuaKelas = kelasId == null && isAdminUser(locals.user);
	// Filter multi-kelas khusus halaman ini (tidak memakai `kelas_id` global).
	const filterKelasIds = (url.searchParams.get('kelas_ids') ?? '')
		.split(',')
		.map((value) => Number(value))
		.filter((id) => Number.isInteger(id) && id > 0);

	const ambilKokurikuler = () =>
		db.query.tableKokurikuler.findMany({
			where: semuaKelas
				? filterKelasIds.length
					? inArray(tableKokurikuler.kelasId, filterKelasIds)
					: undefined
				: eq(tableKokurikuler.kelasId, kelasId ?? -1),
			with: { kelas: { columns: { id: true, nama: true, fase: true } } },
			orderBy: asc(tableKokurikuler.createdAt)
		});

	let kokurikulerRaw: Awaited<ReturnType<typeof ambilKokurikuler>> = [];
	let tableReady = true;

	if (kelasId || semuaKelas) {
		try {
			kokurikulerRaw = await ambilKokurikuler();
		} catch (error) {
			if (isTableMissingError(error)) {
				tableReady = false;
				kokurikulerRaw = [];
			} else {
				throw error;
			}
		}
	}

	// Mapel berkategori kokurikuler (master data) tampil sebagai section terpisah.
	let mapelKokurikuler: Array<{
		id: number;
		nama: string | null;
		kode: string | null;
		jenis: string;
		pengampu: string | null;
	}> = [];
	if (kelasId || semuaKelas) {
		const rows = await db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kode: tableMataPelajaran.kode,
				jenis: tableMataPelajaran.jenis,
				pengampu: tablePegawai.nama
			})
			.from(tableMataPelajaran)
			.leftJoin(tablePegawai, eq(tableMataPelajaran.pengampuId, tablePegawai.id))
			.where(
				semuaKelas
					? eq(tableMataPelajaran.kategori, 'kokurikuler')
					: and(
							eq(tableMataPelajaran.kelasId, kelasId ?? -1),
							eq(tableMataPelajaran.kategori, 'kokurikuler')
						)
			)
			.orderBy(asc(tableMataPelajaran.nama));
		mapelKokurikuler = rows;
	}

	// Kelas yang boleh dikelola akun ini: semua kelas untuk admin, kelas wali +
	// kelas diampu untuk guru/wali kelas.
	let bisaKelolaKelasIds: number[] = [];
	if (locals.user) {
		if (isAdminUser(locals.user)) {
			bisaKelolaKelasIds = (daftarKelas ?? []).map((kelas) => kelas.id);
		} else if (sekolah?.id) {
			bisaKelolaKelasIds = [...(await kelasKontenSet(locals.user, sekolah.id, null))];
		}
	}

	return {
		kelasId,
		semuaKelas,
		filterKelasIds: semuaKelas ? filterKelasIds : [],
		bisaKelolaKelasIds,
		kelasOptions: (daftarKelas ?? []).map(({ id, nama, fase }) => ({ id, nama, fase })),
		tableReady,
		mapelKokurikuler,
		kokurikuler: kokurikulerRaw.map((item) => ({
			...item,
			dimensi: Array.isArray(item.dimensi)
				? (item.dimensi as DimensiProfilLulusanKey[])
				: sanitizeDimensions(
						typeof item.dimensi === 'string'
							? (() => {
									try {
										return JSON.parse(item.dimensi) as string[];
									} catch (error) {
										console.error('Gagal mengurai dimensi kokurikuler', error);
										return [];
									}
								})()
							: []
					)
		})),
		dimensiPilihan: profilPelajarPancasilaDimensions
	};
}

export const actions = {
	add: async ({ request, locals }) => {
		const formData = await request.formData();
		const kode = formData.get('kode')?.toString().trim().toUpperCase() ?? '';
		const tujuan = formData.get('kokurikuler')?.toString().trim() ?? '';
		const dimensi = sanitizeDimensions(
			formData.getAll('dimensi').map((value) => value?.toString() ?? '')
		);
		const kelasIds = [
			...new Set(
				formData
					.getAll('kelasId')
					.map((value) => Number(value))
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		];

		if (!kelasIds.length) {
			return fail(400, { fail: 'Pilih minimal satu kelas' });
		}

		// Hanya admin atau guru/wali yang mengampu kelas-kelas ini yang boleh menambah.
		if (!isAdminUser(locals.user)) {
			const bolehSet =
				locals.user && locals.sekolah?.id
					? await kelasKontenSet(locals.user, locals.sekolah.id, null)
					: new Set<number>();
			if (kelasIds.some((id) => !bolehSet.has(id))) {
				return fail(403, {
					fail: 'Anda tidak memiliki izin untuk menambah kokurikuler di kelas tersebut.'
				});
			}
		}

		if (!dimensi.length) {
			return fail(400, { fail: 'Pilih minimal satu dimensi profil lulusan' });
		}

		if (!kode) {
			return fail(400, { fail: 'Kode kokurikuler wajib diisi' });
		}

		if (!tujuan) {
			return fail(400, { fail: 'Kegiatan kokurikuler wajib diisi' });
		}

		try {
			const existing = await db.query.tableKokurikuler.findMany({
				columns: { kode: true }
			});
			const existingCodes = new Set(existing.map((row) => row.kode.toLowerCase()));

			if (kelasIds.length === 1 && existingCodes.has(kode.toLowerCase())) {
				return fail(400, { fail: 'Kode sudah digunakan' });
			}

			// shortcut: kode unik per sekolah, jadi kelas kedua dst diberi akhiran
			// -2, -3, ...; upgrade ke unique (kelasId, kode) bila perlu kode sama.
			const rows = kelasIds.map((kelasId) => {
				let kodeFinal = kode;
				let urutan = 2;
				while (existingCodes.has(kodeFinal.toLowerCase())) {
					kodeFinal = `${kode}-${urutan}`;
					urutan += 1;
				}
				existingCodes.add(kodeFinal.toLowerCase());
				return { kelasId, kode: kodeFinal, dimensi, tujuan };
			});

			await db.insert(tableKokurikuler).values(rows);

			return {
				message:
					rows.length > 1
						? `Kokurikuler ditambahkan ke ${rows.length} kelas`
						: 'Kokurikuler berhasil ditambahkan',
				kode
			};
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const ids = Array.from(
			new Set(
				formData
					.getAll('ids')
					.map((id) => Number(id))
					.filter((id): id is number => Number.isInteger(id) && id > 0)
			)
		);

		if (ids.length === 0) {
			return fail(400, { fail: 'Pilih data kokurikuler yang akan dihapus' });
		}

		try {
			// wali kelas (termasuk guru merangkap wali) hanya boleh menghapus
			// data di kelas yang dia wali
			const deleteUser = locals.user as { type?: string; pegawaiId?: number | null } | null;
			if (await isWaliKelasAccount(deleteUser)) {
				const ownedIds = await ownedKelasIdSet(deleteUser);
				const rows = await db.query.tableKokurikuler.findMany({
					columns: { id: true, kelasId: true },
					where: inArray(tableKokurikuler.id, ids)
				});
				if (rows.some((r) => !ownedIds.has(r.kelasId))) {
					return fail(403, {
						fail: 'Anda tidak memiliki izin untuk menghapus di kelas ini.'
					});
				}
			}
			await db.delete(tableKokurikuler).where(inArray(tableKokurikuler.id, ids));
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}

		return { message: `${ids.length} kokurikuler berhasil dihapus` };
	},
	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const idRaw = formData.get('id');
		const kelasIdRaw = formData.get('kelasId');
		const kode = formData.get('kode')?.toString().trim().toUpperCase() ?? '';
		const tujuan = formData.get('kokurikuler')?.toString().trim() ?? '';
		const dimensi = sanitizeDimensions(
			formData.getAll('dimensi').map((value) => value?.toString() ?? '')
		);

		if (!idRaw) {
			return fail(400, { fail: 'ID kokurikuler tidak ditemukan' });
		}

		const id = Number(idRaw);
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'ID kokurikuler tidak valid' });
		}

		if (!kelasIdRaw) {
			return fail(400, { fail: 'Kelas aktif tidak ditemukan' });
		}

		const kelasId = Number(kelasIdRaw);
		if (!Number.isInteger(kelasId)) {
			return fail(400, { fail: 'Kelas tidak valid' });
		}

		// Hanya admin atau guru/wali yang mengampu kelas ini yang boleh mengubah.
		if (!isAdminUser(locals.user)) {
			const boleh =
				locals.user && locals.sekolah?.id
					? (await kelasKontenSet(locals.user, locals.sekolah.id, null)).has(kelasId)
					: false;
			if (!boleh) {
				return fail(403, {
					fail: 'Anda tidak memiliki izin untuk mengubah di kelas ini.'
				});
			}
		}

		if (!dimensi.length) {
			return fail(400, { fail: 'Pilih minimal satu dimensi profil lulusan' });
		}

		if (!kode) {
			return fail(400, { fail: 'Kode kokurikuler wajib diisi' });
		}

		if (!tujuan) {
			return fail(400, { fail: 'Kegiatan kokurikuler wajib diisi' });
		}

		try {
			const existing = await db.query.tableKokurikuler.findFirst({
				columns: { id: true },
				where: eq(tableKokurikuler.kode, kode)
			});
			if (existing && existing.id !== id) {
				return fail(400, { fail: 'Kode sudah digunakan' });
			}

			const updated = await db
				.update(tableKokurikuler)
				.set({ kode, dimensi, tujuan, updatedAt: new Date().toISOString() })
				.where(and(eq(tableKokurikuler.id, id), eq(tableKokurikuler.kelasId, kelasId)))
				.returning({ id: tableKokurikuler.id });

			if (!updated.length) {
				return fail(404, { fail: 'Kokurikuler tidak ditemukan atau sudah dihapus' });
			}

			return { message: 'Kokurikuler berhasil diperbarui', id };
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}
	},

	import_kokurikuler: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		// Kelas bisa datang dari form (mode Semua Kelas) atau cookie (perilaku lama).
		const kelasIdForm = Number(formData.get('kelasId'));
		const kelasIdCookie = cookies.get(cookieNames.ACTIVE_KELAS_ID) || null;
		const kelasId =
			Number.isInteger(kelasIdForm) && kelasIdForm > 0
				? kelasIdForm
				: kelasIdCookie && kelasIdCookie !== 'semua'
					? Number(kelasIdCookie)
					: NaN;
		if (!Number.isInteger(kelasId) || kelasId <= 0) {
			return fail(400, { fail: 'Pilih kelas terlebih dahulu.' });
		}

		// Hanya admin atau guru/wali yang mengampu kelas ini yang boleh mengimpor.
		if (!isAdminUser(locals.user)) {
			const boleh =
				locals.user && locals.sekolah?.id
					? (await kelasKontenSet(locals.user, locals.sekolah.id, null)).has(kelasId)
					: false;
			if (!boleh) {
				return fail(403, { fail: 'Anda tidak memiliki izin untuk mengimpor di kelas ini.' });
			}
		}

		const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024; // 2MB

		function normalizeCell(value: unknown) {
			if (value == null) return '';
			if (typeof value === 'string') return value.trim();
			if (typeof value === 'number') return value.toString().trim();
			return String(value).trim();
		}

		function isXlsxMime(type: string | null | undefined) {
			if (!type) return false;
			return type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		}

		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { fail: 'File Excel belum dipilih.' });
		}

		if (file.size > MAX_IMPORT_FILE_SIZE) {
			return fail(400, { fail: 'Ukuran file melebihi 2MB.' });
		}

		const filename = (file.name ?? '').toLowerCase();
		if (!filename.endsWith('.xlsx') && !isXlsxMime(file.type)) {
			return fail(400, { fail: 'Format file harus .xlsx.' });
		}

		let rawRows;
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			rawRows = await readBufferToAoA(buffer);
		} catch (error) {
			console.error('Gagal membaca file Excel', error);
			return fail(400, { fail: 'Gagal membaca file Excel. Pastikan format sesuai.' });
		}

		if (!Array.isArray(rawRows) || rawRows.length === 0) {
			return fail(400, { fail: 'File Excel tidak berisi data.' });
		}

		// Expect header row containing: Kode, Dimensi, Kegiatan
		const headerIndex = rawRows.findIndex((row) => {
			const cols = (row ?? []).map((c) => normalizeCell(c).toLowerCase());
			return cols.some((c) => c.includes('kode')) && cols.some((c) => c.includes('kegiatan'));
		});

		if (headerIndex === -1) {
			return fail(400, {
				fail: 'Template tidak valid. Pastikan kolom Kode dan Kegiatan tersedia.'
			});
		}

		const dataRows = rawRows.slice(headerIndex + 1).filter(Boolean);
		if (!dataRows.length) return fail(400, { fail: 'Tidak ada data pada file.' });

		const dimensionKeyByLabel = new Map<string, DimensiProfilLulusanKey>();
		for (const dimension of profilPelajarPancasilaDimensions) {
			dimensionKeyByLabel.set(dimension.key.toLowerCase(), dimension.key);
			dimensionKeyByLabel.set(dimension.label.toLowerCase(), dimension.key);
		}

		function parseDimensions(value: string): DimensiProfilLulusanKey[] {
			const result: DimensiProfilLulusanKey[] = [];
			for (const part of value.split(',')) {
				const key = dimensionKeyByLabel.get(normalizeCell(part).toLowerCase());
				if (key && !result.includes(key)) result.push(key);
			}
			return result;
		}

		type ParsedEntry = { kode: string; dimensi: DimensiProfilLulusanKey[]; tujuan: string };
		const parsed: ParsedEntry[] = [];

		for (const row of dataRows as (string | number | null | undefined)[][]) {
			const rawKode = normalizeCell(row?.[0] ?? '');
			const rawDimensi = normalizeCell(row?.[1] ?? '');
			const rawTujuan = normalizeCell(row?.[2] ?? '');

			if (!rawKode) continue; // skip rows without kode
			const dimensi = parseDimensions(rawDimensi || '');
			if (dimensi.length === 0) continue; // skip rows without valid dimensi
			parsed.push({
				kode: rawKode.toUpperCase(),
				dimensi,
				tujuan: rawTujuan
			});
		}

		if (parsed.length === 0) return fail(400, { fail: 'Tidak ada data yang valid pada file.' });

		// Persist: insert new kokurikuler, skip existing kode (unique constraint prevents dups).
		let inserted = 0;
		let skipped = 0;

		try {
			// kode is globally unique across all classes, so dedup against all rows,
			// not just the current kelas.
			const existing = await db.query.tableKokurikuler.findMany({
				columns: { kode: true }
			});
			const existingCodes = new Set(existing.map((row) => row.kode.toLowerCase()));

			const unique = new Map<string, ParsedEntry>();
			for (const entry of parsed) {
				const key = entry.kode.toLowerCase();
				if (existingCodes.has(key) || unique.has(key)) {
					skipped += 1;
					continue;
				}
				unique.set(key, entry);
			}

			if (unique.size > 0) {
				await db.insert(tableKokurikuler).values(
					Array.from(unique.values()).map((entry) => ({
						kelasId,
						kode: entry.kode,
						dimensi: entry.dimensi,
						tujuan: entry.tujuan
					}))
				);
				inserted = unique.size;
			}
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}

		const parts = [`Impor selesai: ${inserted} kokurikuler baru ditambahkan.`];
		if (skipped > 0) {
			parts.push(`${skipped} diabaikan karena kode sudah ada.`);
		}
		return { message: parts.join(' ') };
	}
};
