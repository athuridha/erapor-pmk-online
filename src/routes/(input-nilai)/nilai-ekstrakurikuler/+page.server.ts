import db from '$lib/server/db';
import { ensureEkstrakurikulerSchema } from '$lib/server/db/ensure-ekstrakurikuler';
import { ensureAsesmenEkstrakurikulerSchema } from '$lib/server/db/ensure-asesmen-ekstrakurikuler';
import {
	tableAsesmenEkstrakurikuler,
	tableAuthUser,
	tableEkstrakurikuler,
	tableEkstrakurikulerTujuan,
	tableKelas,
	tableMurid,
	tableMuridEkstrakurikuler,
	tablePegawai
} from '$lib/server/db/schema';
import {
	ekstrakurikulerNilaiLabelByValue,
	buildEkstrakurikulerDeskripsi,
	type EkstrakurikulerNilaiKategori,
	isEkstrakurikulerNilaiKategori
} from '$lib/ekstrakurikuler';
import { redirect, error } from '@sveltejs/kit';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { isAuthorizedUser } from '../../pengguna/permissions';

const PER_PAGE = 20;

type NilaiRecord = {
	muridId: number;
	tujuanId: number;
	kategori: string;
	dinilaiPada: string | null;
	updatedAt: string | null;
};

function mapNilaiRecords(records: NilaiRecord[]) {
	const nilaiByMurid = new Map<
		number,
		Map<number, { kategori: EkstrakurikulerNilaiKategori; timestamp: string | null }>
	>();

	for (const record of records) {
		if (!isEkstrakurikulerNilaiKategori(record.kategori)) continue;
		let muridMap = nilaiByMurid.get(record.muridId);
		if (!muridMap) {
			muridMap = new Map<
				number,
				{ kategori: EkstrakurikulerNilaiKategori; timestamp: string | null }
			>();
			nilaiByMurid.set(record.muridId, muridMap);
		}
		const timestamp = record.dinilaiPada ?? record.updatedAt ?? null;
		muridMap.set(record.tujuanId, {
			kategori: record.kategori,
			timestamp
		});
	}

	return nilaiByMurid;
}

export async function load({ parent, url, depends, locals }) {
	depends('app:nilai-ekstrakurikuler');
	await ensureEkstrakurikulerSchema();
	const { kelasAktif } = await parent();
	const meta: PageMeta = { title: 'Nilai Ekstrakurikuler' };
	const user = locals.user;
	const sekolahId = locals.sekolah?.id ?? null;
	const pembinaMode = user?.type === 'pembina_eskul';

	if (pembinaMode) {
		if (!isAuthorizedUser(['input_nilai_nilai_ekstrakurikuler'], user)) {
			throw error(403, 'Anda tidak memiliki izin membuka nilai ekstrakurikuler.');
		}
		if (!sekolahId || !user?.id) {
			return emptyPayload(meta, true);
		}
	} else if (!kelasAktif?.id) {
		return emptyPayload(meta, false);
	}

	const sekolahKelasIds =
		pembinaMode && sekolahId
			? (
					await db
						.select({ id: tableKelas.id })
						.from(tableKelas)
						.where(eq(tableKelas.sekolahId, sekolahId))
				).map((k) => k.id)
			: [];

	if (pembinaMode && sekolahKelasIds.length === 0) {
		return emptyPayload(meta, true);
	}

	const ekstrakRecords = await db.query.tableEkstrakurikuler.findMany({
		columns: {
			id: true,
			nama: true,
			kelasId: true,
			semuaKelas: true,
			pembinaUserId: true,
			pembinaNama: true
		},
		with: { tujuan: { columns: { id: true } } },
		where: pembinaMode
			? and(
					inArray(tableEkstrakurikuler.kelasId, sekolahKelasIds),
					eq(tableEkstrakurikuler.pembinaUserId, user!.id)
				)
			: or(
					eq(tableEkstrakurikuler.kelasId, kelasAktif!.id),
					eq(tableEkstrakurikuler.semuaKelas, 1)
				),
		orderBy: asc(tableEkstrakurikuler.createdAt)
	});

	const pembinaUserIds = [
		...new Set(ekstrakRecords.map((e) => e.pembinaUserId).filter((v): v is number => v != null))
	];
	const pembinaUserRows = pembinaUserIds.length
		? await db
				.select({
					id: tableAuthUser.id,
					username: tableAuthUser.username,
					namaLengkap: tableAuthUser.namaLengkap,
					pegawaiNama: tablePegawai.nama
				})
				.from(tableAuthUser)
				.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
				.where(inArray(tableAuthUser.id, pembinaUserIds))
		: [];
	const pembinaMap = new Map(
		pembinaUserRows.map((u) => [u.id, (u.namaLengkap || u.pegawaiNama || u.username).trim()])
	);

	const ekstrakurikulerList = ekstrakRecords.map((record) => ({
		id: record.id,
		nama: record.nama,
		tujuanCount: record.tujuan.length,
		pembina:
			record.pembinaNama?.trim() ||
			(record.pembinaUserId ? (pembinaMap.get(record.pembinaUserId) ?? null) : null)
	}));

	const requestedIdRaw = url.searchParams.get('ekstrakurikuler_id');
	let requestedId = requestedIdRaw ? Number(requestedIdRaw) : null;
	if (requestedId != null && (!Number.isInteger(requestedId) || requestedId <= 0)) {
		requestedId = null;
	}

	const availableIds = new Set(ekstrakurikulerList.map((item) => item.id));
	let selectedEkstrakurikulerId = requestedId && availableIds.has(requestedId) ? requestedId : null;
	if (!selectedEkstrakurikulerId && ekstrakurikulerList.length === 1) {
		selectedEkstrakurikulerId = ekstrakurikulerList[0].id;
	}

	const selectedEkstrak = selectedEkstrakurikulerId
		? (ekstrakRecords.find((item) => item.id === selectedEkstrakurikulerId) ?? null)
		: null;

	let muridRecords: Array<{ id: number; nama: string; kelasNama: string | null }> = [];
	if (pembinaMode) {
		if (selectedEkstrak) {
			const anggota = await db
				.select({
					id: tableMurid.id,
					nama: tableMurid.nama,
					kelasNama: tableKelas.nama
				})
				.from(tableMuridEkstrakurikuler)
				.innerJoin(tableMurid, eq(tableMuridEkstrakurikuler.muridId, tableMurid.id))
				.innerJoin(tableKelas, eq(tableMurid.kelasId, tableKelas.id))
				.where(eq(tableMuridEkstrakurikuler.ekstrakurikulerId, selectedEkstrak.id))
				.orderBy(asc(tableKelas.nama), asc(tableMurid.nama));

			if (anggota.length > 0 || selectedEkstrak.semuaKelas === 1) {
				muridRecords = anggota;
			} else {
				const fallback = await db
					.select({
						id: tableMurid.id,
						nama: tableMurid.nama,
						kelasNama: tableKelas.nama
					})
					.from(tableMurid)
					.innerJoin(tableKelas, eq(tableMurid.kelasId, tableKelas.id))
					.where(eq(tableMurid.kelasId, selectedEkstrak.kelasId))
					.orderBy(asc(tableMurid.nama));
				muridRecords = fallback;
			}
		}
	} else {
		const rows = await db.query.tableMurid.findMany({
			columns: { id: true, nama: true },
			where: eq(tableMurid.kelasId, kelasAktif!.id),
			orderBy: asc(tableMurid.nama)
		});
		muridRecords = rows.map((r) => ({ id: r.id, nama: r.nama, kelasNama: null }));
	}

	const rawSearch = url.searchParams.get('q')?.trim() ?? '';
	const searchTerm = rawSearch || null;
	const searchLower = searchTerm ? searchTerm.toLowerCase() : null;
	const filteredMurid = searchLower
		? muridRecords.filter((murid) => murid.nama.toLowerCase().includes(searchLower))
		: muridRecords;

	const totalMurid = filteredMurid.length;
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const totalPages = Math.max(1, Math.ceil(totalMurid / PER_PAGE));
	const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

	if (requestedPage !== currentPage) {
		const params = new URLSearchParams(url.searchParams);
		if (currentPage <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(currentPage));
		}
		throw redirect(303, `${url.pathname}${params.size ? `?${params}` : ''}`);
	}

	const offset = (currentPage - 1) * PER_PAGE;
	const paginatedMurid = filteredMurid.slice(offset, offset + PER_PAGE);

	if (!selectedEkstrakurikulerId || !selectedEkstrak) {
		return {
			meta,
			pembinaMode,
			ekstrakurikulerList,
			selectedEkstrakurikulerId: null,
			selectedEkstrakurikuler: null,
			daftarMurid: paginatedMurid.map((murid, index) => ({
				id: murid.id,
				nama: murid.nama,
				kelasNama: murid.kelasNama,
				no: offset + index + 1,
				deskripsi: null,
				hasNilai: false,
				nilai: [],
				lastUpdated: null
			})),
			search: searchTerm,
			totalMurid,
			muridCount: muridRecords.length,
			page: {
				currentPage,
				totalPages,
				totalItems: totalMurid,
				perPage: PER_PAGE,
				search: searchTerm
			}
		};
	}

	const tujuanRecords = await db.query.tableEkstrakurikulerTujuan.findMany({
		columns: { id: true, deskripsi: true },
		where: eq(tableEkstrakurikulerTujuan.ekstrakurikulerId, selectedEkstrakurikulerId),
		orderBy: asc(tableEkstrakurikulerTujuan.createdAt)
	});

	await ensureAsesmenEkstrakurikulerSchema();

	const nilaiRecords = await db.query.tableAsesmenEkstrakurikuler.findMany({
		columns: {
			muridId: true,
			tujuanId: true,
			kategori: true,
			dinilaiPada: true,
			updatedAt: true
		},
		where: eq(tableAsesmenEkstrakurikuler.ekstrakurikulerId, selectedEkstrak.id)
	});

	const nilaiByMurid = mapNilaiRecords(nilaiRecords);

	const daftarMurid = paginatedMurid.map((murid, index) => {
		const nilaiMap = nilaiByMurid.get(murid.id);
		const nilai = tujuanRecords.map((tujuan) => {
			const record = nilaiMap?.get(tujuan.id) ?? null;
			const kategori = record?.kategori ?? null;
			const kategoriLabel = kategori ? ekstrakurikulerNilaiLabelByValue[kategori] : null;
			return {
				tujuanId: tujuan.id,
				tujuan: tujuan.deskripsi,
				kategori: kategori,
				kategoriLabel,
				timestamp: record?.timestamp ?? null
			};
		});

		const filledEntries: Array<{ kategori: EkstrakurikulerNilaiKategori; tujuan: string }> = [];
		for (const item of nilai) {
			if (!item.kategori) continue;
			filledEntries.push({ kategori: item.kategori, tujuan: item.tujuan });
		}
		const deskripsi = buildEkstrakurikulerDeskripsi(filledEntries);
		let lastUpdated: string | null = null;
		for (const item of nilai) {
			if (!item.timestamp) continue;
			if (!lastUpdated || item.timestamp > lastUpdated) {
				lastUpdated = item.timestamp;
			}
		}

		return {
			id: murid.id,
			nama: murid.nama,
			kelasNama: murid.kelasNama,
			no: offset + index + 1,
			nilai,
			deskripsi,
			hasNilai: Boolean(deskripsi),
			lastUpdated
		};
	});

	const selectedPembina =
		selectedEkstrak.pembinaNama?.trim() ||
		(selectedEkstrak.pembinaUserId
			? (pembinaMap.get(selectedEkstrak.pembinaUserId) ?? null)
			: null);

	return {
		meta,
		pembinaMode,
		ekstrakurikulerList,
		selectedEkstrakurikulerId: selectedEkstrak.id,
		selectedEkstrakurikuler: {
			id: selectedEkstrak.id,
			nama: selectedEkstrak.nama,
			pembina: selectedPembina,
			tujuan: tujuanRecords.map((tujuan) => ({
				id: tujuan.id,
				deskripsi: tujuan.deskripsi
			}))
		},
		daftarMurid,
		search: searchTerm,
		totalMurid,
		muridCount: muridRecords.length,
		page: {
			currentPage,
			totalPages,
			totalItems: totalMurid,
			perPage: PER_PAGE,
			search: searchTerm
		}
	};
}

function emptyPayload(meta: PageMeta, pembinaMode = false) {
	return {
		meta,
		pembinaMode,
		ekstrakurikulerList: [],
		selectedEkstrakurikulerId: null,
		selectedEkstrakurikuler: null,
		daftarMurid: [] as Array<{
			id: number;
			nama: string;
			kelasNama: string | null;
			no: number;
			nilai: unknown[];
			deskripsi: string | null;
			hasNilai: boolean;
			lastUpdated: string | null;
		}>,
		search: null as string | null,
		totalMurid: 0,
		muridCount: 0,
		page: {
			currentPage: 1,
			totalPages: 1,
			totalItems: 0,
			perPage: PER_PAGE,
			search: null as string | null
		}
	};
}
