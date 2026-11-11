import db from '$lib/server/db';
import { ensureJurnalMengajarSchema } from '$lib/server/db/ensure-jurnal-mengajar';
import {
	tableJadwalPelajaran,
	tableJurnalMengajar,
	tableKelas,
	tableMataPelajaran,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildKelasContext } from '$lib/server/route-utils';
import { queryInChunks } from '$lib/server/db/chunk';
import { agamaMapelNames } from '$lib/statics';
import { getAksesMapelUser } from '$lib/server/mapel-access';
import { isWaliOfKelas } from '$lib/server/kelas-akses';
import { isAdminUser } from '../../pengguna/permissions';

const PER_PAGE = 20;

function isValidDate(s: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const [y, m, d] = s.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export async function load({ locals, url, depends, parent }) {
	depends('app:jurnal-mengajar');
	await ensureJurnalMengajarSchema();

	const parentData = await parent();
	const { sekolahId, kelasId, kelasIds, academicContext } = await buildKelasContext(
		locals,
		parentData,
		url
	);

	const user = locals.user as {
		id?: number;
		type?: string;
		mataPelajaranId?: number | null;
	} | null;

	const tanggalParam = url.searchParams.get('tanggal');
	const today = new Date().toISOString().split('T')[0];
	const tanggal = tanggalParam && isValidDate(tanggalParam) ? tanggalParam : today;

	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	if (!sekolahId || !kelasIds.length) {
		return {
			meta: { title: 'Jurnal Mengajar' },
			academicContext,
			daftarJurnal: [],
			tujuanPembelajaranList: [],
			lingkupMateriList: [],
			mataPelajaranList: [],
			hasAnyMapel: false,
			mapelId: null,
			tanggal: null,
			page: {
				kelasId,
				currentPage: 1,
				totalPages: 1,
				totalItems: 0,
				perPage: PER_PAGE
			}
		};
	}

	const userType = user?.type ?? '';

	// Determine which mataPelajaranIds are available
	const kelasIdNum = kelasId ? Number(kelasId) : null;
	const effectiveKelasIds = kelasIdNum ? [kelasIdNum] : kelasIds;

	// Get all mata pelajaran for the relevant classes
	let mataPelajaranList: Array<{ id: number; nama: string; kode: string | null }> = [];
	let mapelIds: number[] = [];

	let hasAnyMapel = false;

	if (isAdminUser(user) || userType === 'wali_kelas') {
		const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
		const dateObj = tanggal ? new Date(tanggal + 'T00:00:00') : new Date();
		const hari = dayNames[dateObj.getDay()];
		const tambahanKode = new Set(['IST', 'PLG']);

		const allMapelForClass = await db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kode: tableMataPelajaran.kode
			})
			.from(tableMataPelajaran)
			.where(inArray(tableMataPelajaran.kelasId, effectiveKelasIds))
			.orderBy(asc(tableMataPelajaran.nama));

		hasAnyMapel = allMapelForClass.length > 0;

		const jadwalEntries = await db.query.tableJadwalPelajaran.findMany({
			columns: { kodeKegiatan: true },
			where: and(
				eq(tableJadwalPelajaran.sekolahId, sekolahId),
				inArray(tableJadwalPelajaran.kelasId, effectiveKelasIds),
				eq(tableJadwalPelajaran.hari, hari)
			)
		});

		const uniqueKode = [
			...new Set(
				jadwalEntries.map((j) => j.kodeKegiatan).filter((k) => !tambahanKode.has(k.toUpperCase()))
			)
		];

		if (uniqueKode.length > 0) {
			const matchingMp = await db.query.tableMataPelajaran.findMany({
				columns: { id: true, kode: true, nama: true },
				where: and(
					inArray(tableMataPelajaran.kelasId, effectiveKelasIds),
					inArray(tableMataPelajaran.kode, uniqueKode)
				)
			});

			const kodeToMpMap = new Map<string, { id: number; nama: string }>();
			for (const mp of matchingMp) {
				if (mp.kode) kodeToMpMap.set(mp.kode, { id: mp.id, nama: mp.nama });
			}

			if (uniqueKode.includes('PAPB') && !kodeToMpMap.has('PAPB')) {
				const agamaMp = await db.query.tableMataPelajaran.findMany({
					columns: { id: true, nama: true },
					where: and(
						inArray(tableMataPelajaran.kelasId, effectiveKelasIds),
						inArray(tableMataPelajaran.nama, agamaMapelNames)
					)
				});
				if (agamaMp.length > 0) {
					kodeToMpMap.set('PAPB', { id: agamaMp[0].id, nama: agamaMp[0].nama });
				}
			}

			mataPelajaranList = uniqueKode
				.map((kode) => kodeToMpMap.get(kode))
				.filter((mp): mp is { id: number; nama: string } => !!mp)
				.map((mp) => ({ ...mp, kode: null }));
		}

		// Jadwal bisa kosong (mis. belum diisi untuk hari ini). Tanpa fallback,
		// dropdown mapel/lingkup materi di form Tambah Jurnal tidak punya opsi.
		if (!mataPelajaranList.length) mataPelajaranList = allMapelForClass;
		mapelIds = mataPelajaranList.map((mp) => mp.id);
	} else if (userType === 'user') {
		const akses = await getAksesMapelUser(
			{ id: user?.id ?? 0, mataPelajaranId: user?.mataPelajaranId },
			kelasIdNum
		);
		const userMpIds: number[] = Array.from(akses.ids);

		const userMapels =
			userMpIds.length > 0
				? await db
						.select({
							id: tableMataPelajaran.id,
							nama: tableMataPelajaran.nama,
							kode: tableMataPelajaran.kode,
							kelasId: tableMataPelajaran.kelasId
						})
						.from(tableMataPelajaran)
						.where(inArray(tableMataPelajaran.id, userMpIds))
						.orderBy(asc(tableMataPelajaran.nama))
				: [];

		hasAnyMapel = userMapels.length > 0;

		if (userMapels.length > 0) {
			const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
			const dateObj = tanggal ? new Date(tanggal + 'T00:00:00') : new Date();
			const hari = dayNames[dateObj.getDay()];
			const tambahanKode = new Set(['IST', 'PLG']);

			const jadwalEntries = await db.query.tableJadwalPelajaran.findMany({
				columns: { kodeKegiatan: true },
				where: and(
					eq(tableJadwalPelajaran.sekolahId, sekolahId),
					inArray(tableJadwalPelajaran.kelasId, effectiveKelasIds),
					eq(tableJadwalPelajaran.hari, hari)
				)
			});

			const uniqueKode = [
				...new Set(
					jadwalEntries.map((j) => j.kodeKegiatan).filter((k) => !tambahanKode.has(k.toUpperCase()))
				)
			];

			if (uniqueKode.length > 0) {
				const matchingMp = await db.query.tableMataPelajaran.findMany({
					columns: { id: true, kode: true, nama: true },
					where: and(
						inArray(tableMataPelajaran.kelasId, effectiveKelasIds),
						inArray(tableMataPelajaran.kode, uniqueKode)
					)
				});

				const kodeToMpMap = new Map<string, { id: number; nama: string }>();
				for (const mp of matchingMp) {
					if (mp.kode) kodeToMpMap.set(mp.kode, { id: mp.id, nama: mp.nama });
				}

				// Always run agama fallback for PAPB to capture all variants (Kristen, Katolik, dll)
				// even if a matchingMp entry with kode='PAPB' already exists, since
				// a single 'PAPB' key in kodeToMpMap can only hold one subject.
				if (uniqueKode.includes('PAPB')) {
					const agamaMp = await db.query.tableMataPelajaran.findMany({
						columns: { id: true, nama: true },
						where: and(
							inArray(tableMataPelajaran.kelasId, effectiveKelasIds),
							inArray(tableMataPelajaran.nama, agamaMapelNames)
						)
					});
					for (const am of agamaMp) {
						kodeToMpMap.set('PAPB-' + am.id, { id: am.id, nama: am.nama });
					}
				}

				mataPelajaranList = uniqueKode
					.flatMap((kode) => {
						if (kode === 'PAPB') {
							const result: Array<{ id: number; nama: string }> = [];
							for (const [key, mp] of kodeToMpMap.entries()) {
								if (key === 'PAPB' || key.startsWith('PAPB-')) {
									result.push(mp);
								}
							}
							return result;
						}
						const mp = kodeToMpMap.get(kode);
						return mp ? [mp] : [];
					})
					.filter((mp) => {
						if (akses.ids.has(mp.id)) return true;
						return akses.names.has(mp.nama?.trim().toLowerCase() ?? '');
					})
					.map((mp) => ({ ...mp, kode: null }));

				const seen = new Set<number>();
				mataPelajaranList = mataPelajaranList.filter((mp) => {
					if (seen.has(mp.id)) return false;
					seen.add(mp.id);
					return true;
				});
			}

			// Fallback: guru tetap bisa menulis jurnal meski jadwal hari ini kosong;
			// pilihannya dibatasi ke mapel yang diampu guru DAN milik kelas aktif.
			if (!mataPelajaranList.length) {
				mataPelajaranList = userMapels.filter((mp) => effectiveKelasIds.includes(mp.kelasId));
			}
			mapelIds = mataPelajaranList.map((mp) => mp.id);
		}
	}

	// Daftar mapel final (hasil jadwal atau fallback) menentukan apakah form bisa
	// dibuka; guru yang tidak mengampu mapel di kelas aktif tetap melihat pesan.
	hasAnyMapel = mataPelajaranList.length > 0;

	// Get mapelId from URL param or default to first
	const mapelIdParam = url.searchParams.get('mapel_id');
	const paramMapelId =
		mapelIdParam && mapelIds.some((id) => id === Number(mapelIdParam))
			? Number(mapelIdParam)
			: null;

	// Load Tujuan Pembelajaran for lingkupMateri + TP dropdowns.
	// Satu kelas bisa berisi puluhan mapel, dan mode "Semua Kelas" menggabung
	// seluruh mapel sekolah — D1 menolak statement dengan >100 parameter, jadi
	// daftar mapel dipecah dulu lalu hasilnya digabung dan diurutkan ulang.
	const tujuanPembelajaranList = mapelIds.length
		? (
				await queryInChunks(mapelIds, (ids) =>
					db
						.select({
							id: tableTujuanPembelajaran.id,
							deskripsi: tableTujuanPembelajaran.deskripsi,
							lingkupMateri: tableTujuanPembelajaran.lingkupMateri,
							mataPelajaranId: tableTujuanPembelajaran.mataPelajaranId
						})
						.from(tableTujuanPembelajaran)
						.where(inArray(tableTujuanPembelajaran.mataPelajaranId, ids))
						.orderBy(asc(tableTujuanPembelajaran.lingkupMateri))
				)
			).sort((a, b) => (a.lingkupMateri ?? '').localeCompare(b.lingkupMateri ?? '', 'id'))
		: [];

	// Default mapel: pakai pilihan URL, atau mapel pertama yang punya TP/lingkup
	// materi supaya dropdown Lingkup Materi langsung terisi saat modal dibuka.
	const mapelId =
		paramMapelId ??
		tujuanPembelajaranList[0]?.mataPelajaranId ??
		(mapelIds.length > 0 ? mapelIds[0] : null);

	const lingkupMateriSet = new Set<string>();
	for (const tp of tujuanPembelajaranList) {
		if (tp.lingkupMateri) lingkupMateriSet.add(tp.lingkupMateri);
	}
	const lingkupMateriList = Array.from(lingkupMateriSet).sort();

	// Count total journals
	const countFilter = and(
		eq(tableJurnalMengajar.authUserId, user?.id ?? 0),
		tanggal ? eq(tableJurnalMengajar.tanggal, tanggal) : undefined,
		kelasIdNum
			? eq(tableJurnalMengajar.kelasId, kelasIdNum)
			: inArray(tableJurnalMengajar.kelasId, kelasIds)
	);

	const [{ totalItems }] = await db
		.select({ totalItems: sql<number>`count(*)` })
		.from(tableJurnalMengajar)
		.where(countFilter);

	const total = totalItems ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * PER_PAGE;

	if (pageNumber !== currentPage) {
		const params = new URLSearchParams(url.searchParams);
		if (currentPage <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(currentPage));
		}
		throw redirect(303, `${url.pathname}${params.size ? `?${params}` : ''}`);
	}

	// Load journal entries with joins
	const rows = await db
		.select({
			id: tableJurnalMengajar.id,
			tanggal: tableJurnalMengajar.tanggal,
			jamPelajaran: tableJurnalMengajar.jamPelajaran,
			lingkupMateri: tableJurnalMengajar.lingkupMateri,
			catatan: tableJurnalMengajar.catatan,
			mataPelajaranId: tableJurnalMengajar.mataPelajaranId,
			kelasNama: tableKelas.nama,
			mapelNama: tableMataPelajaran.nama,
			tpDeskripsi: tableTujuanPembelajaran.deskripsi,
			tpId: tableTujuanPembelajaran.id,
			updatedAt: tableJurnalMengajar.updatedAt,
			kelasId: tableJurnalMengajar.kelasId
		})
		.from(tableJurnalMengajar)
		.leftJoin(tableKelas, eq(tableJurnalMengajar.kelasId, tableKelas.id))
		.leftJoin(tableMataPelajaran, eq(tableJurnalMengajar.mataPelajaranId, tableMataPelajaran.id))
		.leftJoin(
			tableTujuanPembelajaran,
			eq(tableJurnalMengajar.tujuanPembelajaranId, tableTujuanPembelajaran.id)
		)
		.where(countFilter)
		.orderBy(desc(tableJurnalMengajar.tanggal))
		.limit(PER_PAGE)
		.offset(offset);

	const daftarJurnal = rows.map((row, index) => ({
		id: row.id,
		tanggal: row.tanggal,
		jamPelajaran: row.jamPelajaran,
		lingkupMateri: row.lingkupMateri,
		catatan: row.catatan ?? '',
		mataPelajaranId: row.mataPelajaranId,
		kelasNama: row.kelasNama ?? '',
		mapelNama: row.mapelNama ?? '',
		tpDeskripsi: row.tpDeskripsi ?? '',
		tpId: row.tpId,
		kelasId: row.kelasId,
		updatedAt: row.updatedAt,
		no: offset + index + 1
	}));

	return {
		meta: { title: 'Jurnal Mengajar' },
		academicContext,
		daftarJurnal,
		tujuanPembelajaranList,
		lingkupMateriList,
		mataPelajaranList,
		hasAnyMapel,
		mapelId,
		tanggal,
		userType,
		page: {
			kelasId,
			currentPage,
			totalPages,
			totalItems: total,
			perPage: PER_PAGE
		}
	};
}

export const actions = {
	save: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}

		const user = locals.user as { id?: number; type?: string; pegawaiId?: number | null } | null;
		if (!user?.id) {
			return fail(401, { fail: 'Anda harus login terlebih dahulu' });
		}

		if (user.type === 'wali_asuh') {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menulis jurnal mengajar.' });
		}

		await ensureJurnalMengajarSchema();

		const formData = await request.formData();
		const idRaw = formData.get('id');
		const kelasIdRaw = formData.get('kelasId');
		const mataPelajaranIdRaw = formData.get('mataPelajaranId');
		const lingkupMateri = formData.get('lingkupMateri') as string | null;
		const tujuanPembelajaranIdRaw = formData.get('tujuanPembelajaranId');
		const catatan = (formData.get('catatan') as string | null) ?? '';
		const tanggal = (formData.get('tanggal') as string | null) ?? '';

		const kelasId = Number(kelasIdRaw);
		const mataPelajaranId = Number(mataPelajaranIdRaw);
		const tujuanPembelajaranId = tujuanPembelajaranIdRaw ? Number(tujuanPembelajaranIdRaw) : null;

		if (!lingkupMateri) {
			return fail(400, { fail: 'Lingkup materi harus diisi' });
		}

		if (catatan.length > 300) {
			return fail(400, { fail: 'Catatan maksimal 300 karakter' });
		}

		if (!Number.isInteger(kelasId) || kelasId <= 0) {
			return fail(400, { fail: 'Kelas tidak valid' });
		}
		const kelasCheck = await db.query.tableKelas.findFirst({
			columns: { id: true, sekolahId: true },
			where: eq(tableKelas.id, kelasId)
		});
		if (!kelasCheck || kelasCheck.sekolahId !== sekolahId) {
			return fail(400, { fail: 'Kelas tidak valid' });
		}
		if (!Number.isInteger(mataPelajaranId) || mataPelajaranId <= 0) {
			return fail(400, { fail: 'Mata pelajaran tidak valid' });
		}

		const now = new Date().toISOString();
		const id = idRaw ? Number(idRaw) : null;

		if (id) {
			// Edit existing — preserve original tanggal & jamPelajaran
			const existing = await db.query.tableJurnalMengajar.findFirst({
				columns: { id: true, authUserId: true, kelasId: true },
				where: eq(tableJurnalMengajar.id, id)
			});
			let waliMengampuJurnal = false;
			if (existing?.kelasId && user.type === 'user' && user.pegawaiId) {
				// Guru merangkap wali kelas: boleh mengedit jurnal lain di kelas diwali-nya.
				waliMengampuJurnal = await isWaliOfKelas(user, existing.kelasId);
			}
			if (
				!existing ||
				(existing.authUserId !== user.id &&
					!isAdminUser(user) &&
					user.type !== 'wali_kelas' &&
					!waliMengampuJurnal)
			) {
				return fail(404, { fail: 'Jurnal tidak ditemukan' });
			}

			await db
				.update(tableJurnalMengajar)
				.set({
					kelasId,
					mataPelajaranId,
					lingkupMateri,
					tujuanPembelajaranId,
					catatan: catatan || null,
					updatedAt: now
				})
				.where(eq(tableJurnalMengajar.id, id));
		} else {
			// Create new — auto-derive tanggal & jamPelajaran
			const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
			if (!tanggal) {
				return fail(400, { fail: 'Tanggal tidak valid' });
			}
			const dateObj = new Date(tanggal + 'T00:00:00');
			const hari = dayNames[dateObj.getDay()];

			const mpRow = await db.query.tableMataPelajaran.findFirst({
				columns: { kode: true, nama: true, kelasId: true },
				where: eq(tableMataPelajaran.id, mataPelajaranId)
			});
			if (!mpRow) {
				return fail(400, { fail: 'Mata pelajaran tidak valid' });
			}
			if (mpRow.kelasId !== kelasId) {
				return fail(400, { fail: 'Mata pelajaran ini bukan milik kelas yang dipilih' });
			}

			let jadwalEntries: Array<{ jamKe: number }> = [];
			if (mpRow.kode) {
				jadwalEntries = await db.query.tableJadwalPelajaran.findMany({
					columns: { jamKe: true },
					where: and(
						eq(tableJadwalPelajaran.sekolahId, sekolahId),
						eq(tableJadwalPelajaran.kelasId, kelasId),
						eq(tableJadwalPelajaran.hari, hari),
						eq(tableJadwalPelajaran.kodeKegiatan, mpRow.kode)
					),
					orderBy: [asc(tableJadwalPelajaran.jamKe)]
				});
			}

			if (jadwalEntries.length === 0) {
				if (mpRow.nama && agamaMapelNames.includes(mpRow.nama)) {
					jadwalEntries = await db.query.tableJadwalPelajaran.findMany({
						columns: { jamKe: true },
						where: and(
							eq(tableJadwalPelajaran.sekolahId, sekolahId),
							eq(tableJadwalPelajaran.kelasId, kelasId),
							eq(tableJadwalPelajaran.hari, hari),
							eq(tableJadwalPelajaran.kodeKegiatan, 'PAPB')
						),
						orderBy: [asc(tableJadwalPelajaran.jamKe)]
					});
				}
			}

			// Jurnal tetap boleh dibuat walau jadwal mapel belum diisi; jam pelajaran
			// disimpan sebagai '-' bila tidak bisa diturunkan dari jadwal.
			const jamPelajaran =
				jadwalEntries.length === 0
					? '-'
					: jadwalEntries.length === 1
						? String(jadwalEntries[0].jamKe)
						: `${Math.min(...jadwalEntries.map((j) => j.jamKe))}-${Math.max(...jadwalEntries.map((j) => j.jamKe))}`;

			await db.insert(tableJurnalMengajar).values({
				authUserId: user.id,
				kelasId,
				mataPelajaranId,
				tanggal,
				jamPelajaran,
				lingkupMateri,
				tujuanPembelajaranId,
				catatan: catatan || null,
				updatedAt: now
			});
		}

		return { message: 'Jurnal tersimpan' };
	},

	delete: async ({ request, locals }) => {
		const user = locals.user as { id?: number; type?: string; pegawaiId?: number | null } | null;
		if (!user?.id) {
			return fail(401, { fail: 'Anda harus login terlebih dahulu' });
		}

		if (user.type === 'wali_asuh') {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk menghapus jurnal.' });
		}

		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return fail(401, { fail: 'Sekolah tidak ditemukan' });
		}

		await ensureJurnalMengajarSchema();

		const formData = await request.formData();
		const idRaw = formData.get('id');
		const id = Number(idRaw);

		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'ID jurnal tidak valid' });
		}

		const existing = await db.query.tableJurnalMengajar.findFirst({
			columns: { id: true, authUserId: true, kelasId: true },
			where: eq(tableJurnalMengajar.id, id)
		});
		let waliMengampuJurnal = false;
		if (existing?.kelasId && user.type === 'user' && user.pegawaiId) {
			// Guru merangkap wali kelas: boleh menghapus jurnal lain di kelas diwali-nya.
			waliMengampuJurnal = await isWaliOfKelas(user, existing.kelasId);
		}
		if (
			!existing ||
			(existing.authUserId !== user.id &&
				!isAdminUser(user) &&
				user.type !== 'wali_kelas' &&
				!waliMengampuJurnal)
		) {
			return fail(404, { fail: 'Jurnal tidak ditemukan' });
		}

		const kelasCheck = await db.query.tableKelas.findFirst({
			columns: { id: true, sekolahId: true },
			where: eq(tableKelas.id, existing.kelasId)
		});
		if (!kelasCheck || kelasCheck.sekolahId !== sekolahId) {
			return fail(404, { fail: 'Jurnal tidak ditemukan' });
		}

		await db.delete(tableJurnalMengajar).where(eq(tableJurnalMengajar.id, id));
		return { message: 'Jurnal dihapus' };
	}
};
