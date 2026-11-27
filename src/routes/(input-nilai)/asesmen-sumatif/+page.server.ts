import db from '$lib/server/db';
import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import { queryInChunks, chunk } from '$lib/server/db/chunk';
import {
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableTeknikPenilaian,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { bolehAksesMapel, getAksesMapelUser, needsMapelFilter } from '$lib/server/mapel-access';
import { ownedKelasIdSet } from '$lib/server/kelas-akses';
import { labelVarianUntukMurid, muridAgamaKey } from '$lib/server/mapel-picker';
import { agamaMapelOptions, pksMapelOptions } from '$lib/statics';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { loadKunciNilai } from '$lib/server/nilai-kunci';
import {
	bobotMapelEfektif,
	effectiveColumnBobot,
	hitungNilaiAkhirRts,
	hitungNilaiAkhirSumatif,
	hitungRataBerbobot,
	konfigurasiNilaiDariSekolah,
	nilaiEfektifAkhir,
	recalcMapelSumatifScores,
	type JenisAsesmen
} from '$lib/server/nilai-sumatif';

const AGAMA_BASE_SUBJECT = 'Pendidikan Agama dan Budi Pekerti';
const PKS_BASE_SUBJECT = 'Pendalaman Kitab Suci';
const AGAMA_MAPEL_VALUE = 'agama';
const PKS_MAPEL_VALUE = 'pks';

function normalizeText(value: string | null | undefined) {
	return value?.trim().toLowerCase() ?? '';
}

function isAgamaSubject(name: string) {
	// Mencakup varian "Pendidikan Kepercayaan terhadap Tuhan YME dan Budi Pekerti".
	return /^pendidikan (agama|kepercayaan)/i.test(normalizeText(name));
}

function isPksSubject(name: string) {
	return normalizeText(name).startsWith('pendalaman kitab suci');
}

function resolveAgamaVariantName(agama: string | null | undefined) {
	const key = muridAgamaKey(agama);
	return agamaMapelOptions.find((option) => option.key === key)?.name ?? null;
}

function resolvePksVariantName(agama: string | null | undefined) {
	const key = muridAgamaKey(agama);
	return pksMapelOptions.find((option) => option.key === key)?.name ?? null;
}

function formatScore(value: number | null | undefined) {
	if (value == null || Number.isNaN(value)) return null;
	return Number.parseFloat(value.toFixed(2));
}

function sanitizeScore(raw: unknown): number | null {
	if (raw == null) return null;
	const text = String(raw).trim().replace(',', '.');
	if (!text) return null;
	const num = Number(text);
	if (!Number.isFinite(num)) return null;
	return Math.min(100, Math.max(0, Math.round(num * 100) / 100));
}

function parseJenisAsesmen(raw: unknown): JenisAsesmen {
	if (raw === 'sumatif' || raw === 'as') return raw;
	return 'formatif';
}

type MapelOption = { value: string; nama: string };

type MuridRow = {
	id: number;
	no: number;
	nama: string;
	agamaLabel?: string | null;
	/** mapelId efektif baris ini (varian agama/PKS sudah di-resolve) — dipakai isi massal & simpan. */
	mapelId: number | null;
	nilaiAkhirRts: number | null;
	nilaiAkhirAsli: number | null;
	nilaiRevisi: number | null;
	nilaiAkhir: number | null;
	naLingkup: number | null;
	sts: number | null;
	sas: number | null;
	nilaiHref: string | null;
	canNilai: boolean;
	/** True bila data milik guru lain (murid di luar varian/mapel guru). */
	diisiUserLain?: boolean;
	tpScores: Record<number, number | null>;
};

type PageState = {
	search: string | null;
	currentPage: number;
	totalPages: number;
	totalItems: number;
	perPage: number;
};

type ActionLocals = {
	sekolah?: {
		id: number;
		sumatifBobotLingkup?: number | null;
		sumatifBobotSts?: number | null;
		sumatifBobotSas?: number | null;
		sumatifBobotRtsLingkup?: number | null;
		sumatifBobotRtsSts?: number | null;
		raporKriteriaCukup?: number | null;
		raporKriteriaBaik?: number | null;
	} | null;
	user?: {
		id?: number;
		type?: string;
		mataPelajaranId?: number | null;
		pegawaiId?: number | null;
	} | null;
};

async function assertCanEditMapels(locals: ActionLocals, mapelIds: number[]) {
	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) return { error: fail(401, { fail: 'Sekolah aktif tidak ditemukan.' }) };

	const user = locals.user ?? null;
	if (!user?.id) return { error: fail(401, { fail: 'Sesi pengguna tidak valid.' }) };
	if (user.type === 'wali_asuh') {
		return { error: fail(403, { fail: 'Akun wali asuh tidak dapat mengubah nilai.' }) };
	}

	const uniqueIds = Array.from(new Set(mapelIds.filter((id) => Number.isInteger(id) && id > 0)));
	if (!uniqueIds.length) {
		return { error: fail(400, { fail: 'Mata pelajaran tidak ditemukan.' }) };
	}

	const mapelRows = await queryInChunks(uniqueIds, (ids) =>
		db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kelasId: tableMataPelajaran.kelasId,
				bobotFormatif: tableMataPelajaran.bobotFormatif,
				bobotSumatif: tableMataPelajaran.bobotSumatif,
				bobotAs: tableMataPelajaran.bobotAs
			})
			.from(tableMataPelajaran)
			.where(inArray(tableMataPelajaran.id, ids))
	);
	if (mapelRows.length !== uniqueIds.length) {
		return { error: fail(404, { fail: 'Sebagian mata pelajaran tidak ditemukan.' }) };
	}

	const kelasIds = Array.from(new Set(mapelRows.map((m) => m.kelasId)));
	const kelasRows = await queryInChunks(kelasIds, (ids) =>
		db
			.select({
				id: tableKelas.id,
				sekolahId: tableKelas.sekolahId,
				waliKelasId: tableKelas.waliKelasId
			})
			.from(tableKelas)
			.where(inArray(tableKelas.id, ids))
	);
	const kelasById = new Map(kelasRows.map((k) => [k.id, k]));

	for (const mapel of mapelRows) {
		const kelas = kelasById.get(mapel.kelasId);
		if (!kelas || kelas.sekolahId !== sekolahId) {
			return { error: fail(403, { fail: 'Mata pelajaran bukan milik sekolah aktif.' }) };
		}
	}

	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		const ownKelas =
			user.type === 'user' || user.type === 'wali_kelas'
				? await ownedKelasIdSet(user)
				: new Set<number>();

		for (const mapel of mapelRows) {
			const kelas = kelasById.get(mapel.kelasId);
			if (ownKelas.has(mapel.kelasId)) continue;
			if (user.type === 'wali_kelas' && user.pegawaiId && kelas?.waliKelasId === user.pegawaiId) {
				continue;
			}
			const allowed = await bolehAksesMapel(
				{ id: user.id, mataPelajaranId: user.mataPelajaranId ?? null },
				{ id: mapel.id, nama: mapel.nama }
			);
			if (!allowed) {
				return {
					error: fail(403, { fail: `Anda tidak memiliki akses ke mata pelajaran ${mapel.nama}.` })
				};
			}
		}
	}

	for (const part of chunk(uniqueIds, 90)) {
		const kunci = await loadKunciNilai(part);
		for (const [lockedId, info] of kunci) {
			const lockedMapel = mapelRows.find((m) => m.id === lockedId);
			return {
				error: fail(403, {
					fail: `Nilai ${lockedMapel?.nama ?? 'mata pelajaran'} sudah dikunci${
						info?.dikunciOleh ? ` oleh ${info.dikunciOleh}` : ''
					}. Hubungi operator untuk membuka kunci.`
				})
			};
		}
	}

	return {
		error: null,
		sekolahId,
		mapelRows,
		mapelById: new Map(mapelRows.map((m) => [m.id, m]))
	};
}

export async function load({ parent, url, depends, locals }) {
	depends('app:asesmen-sumatif');
	await ensureAsesmenSumatifSchema();

	const { kelasAktif, kelasKonten, user } = await parent();
	const kelasKontenAktif = kelasKonten ?? kelasAktif;
	const meta: PageMeta = { title: 'Penilaian' };

	const searchParam = url.searchParams.get('q');
	const searchTrimmed = searchParam ? searchParam.trim() : '';
	const search = searchTrimmed.length ? searchTrimmed : null;
	const perPageParam = Number(url.searchParams.get('perPage'));
	const perPage = Number.isFinite(perPageParam) && perPageParam > 0 ? perPageParam : 50;
	const requestedPage = Number(url.searchParams.get('page')) || 1;
	const pageNumber =
		Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

	if (!kelasKontenAktif?.id) {
		const pageState: PageState = {
			search,
			currentPage: 1,
			totalPages: 1,
			totalItems: 0,
			perPage
		};
		return {
			meta,
			kelasKontenAktif: null,
			mapelList: [] as MapelOption[],
			selectedMapelValue: null as string | null,
			selectedMapel: null as { id: number | null; nama: string } | null,
			relevantMapelIds: [] as number[],
			daftarMurid: [] as MuridRow[],
			tujuanList: [],
			teknikList: [],
			page: pageState
		};
	}

	let mapelRecords = await db.query.tableMataPelajaran.findMany({
		columns: {
			id: true,
			nama: true,
			namaLokal: true,
			kkm: true,
			bobotFormatif: true,
			bobotSumatif: true,
			bobotAs: true
		},
		where: eq(tableMataPelajaran.kelasId, kelasKontenAktif.id),
		orderBy: asc(tableMataPelajaran.nama)
	});

	const maybeUser = user as unknown as
		{ id?: number; type?: string; mataPelajaranId?: number; pegawaiId?: number | null } | undefined;
	const guruOwnKelasIds =
		maybeUser?.type === 'user' ? Array.from(await ownedKelasIdSet(maybeUser)) : null;
	const assignedMapelIds = new Set<number>();
	let userAkses: Awaited<ReturnType<typeof getAksesMapelUser>> | null = null;

	if (
		needsMapelFilter(
			{ ...maybeUser, ownKelasIds: guruOwnKelasIds },
			kelasKontenAktif?.id ?? null
		) &&
		maybeUser?.id
	) {
		try {
			userAkses = await getAksesMapelUser(
				{
					id: maybeUser.id,
					mataPelajaranId: maybeUser.mataPelajaranId
				},
				kelasKontenAktif?.id ?? null
			);
			mapelRecords = mapelRecords.filter(
				(r) => userAkses!.ids.has(r.id) || userAkses!.names.has(normalizeText(r.nama))
			);
			for (const id of userAkses.ids) {
				assignedMapelIds.add(id);
			}
		} catch {
			// Silently handle error
		}
	}

	const mapelByName = new Map(mapelRecords.map((record) => [normalizeText(record.nama), record]));
	const mapelById = new Map(mapelRecords.map((record) => [record.id, record]));

	let assignedLocalMapelId: number | null = null;
	let assignedIsAgamaVariant = false;
	if (
		needsMapelFilter(
			{ ...maybeUser, ownKelasIds: guruOwnKelasIds },
			kelasKontenAktif?.id ?? null
		) &&
		maybeUser?.id
	) {
		if (assignedMapelIds.size > 0) {
			const firstAssignedId = Array.from(assignedMapelIds)[0];
			const found = mapelRecords.find((r) => r.id === firstAssignedId);
			if (found) {
				assignedLocalMapelId = found.id;
				const norm = normalizeText(found.nama);
				assignedIsAgamaVariant =
					(norm.startsWith('pendidikan agama') && norm !== normalizeText(AGAMA_BASE_SUBJECT)) ||
					(norm.startsWith('pendalaman kitab suci') && norm !== normalizeText(PKS_BASE_SUBJECT));
			}
		} else if (maybeUser.mataPelajaranId) {
			try {
				const assigned = await db.query.tableMataPelajaran.findFirst({
					columns: { id: true, nama: true },
					where: eq(tableMataPelajaran.id, Number(maybeUser.mataPelajaranId))
				});
				if (assigned && assigned.nama) {
					const norm = normalizeText(assigned.nama);
					assignedIsAgamaVariant =
						(norm.startsWith('pendidikan agama') && norm !== normalizeText(AGAMA_BASE_SUBJECT)) ||
						(norm.startsWith('pendalaman kitab suci') && norm !== normalizeText(PKS_BASE_SUBJECT));
					const found = mapelRecords.find((r) => normalizeText(r.nama) === norm);
					if (found) assignedLocalMapelId = found.id;
				} else {
					const foundById = mapelRecords.find((r) => r.id === Number(maybeUser.mataPelajaranId));
					if (foundById) assignedLocalMapelId = foundById.id;
				}
			} catch {
				// Silently handle error
			}
		}
	}

	const allowedAgamaVariants = new Set<string>();
	if (userAkses) {
		for (const option of [...agamaMapelOptions, ...pksMapelOptions]) {
			if (option.key !== 'umum' && userAkses.names.has(normalizeText(option.name))) {
				allowedAgamaVariants.add(option.label);
			}
		}
	}

	const allowedAgamaForUser: string[] = Array.from(allowedAgamaVariants);

	let agamaBaseMapel: (typeof mapelRecords)[number] | null = null;
	let pksBaseMapel: (typeof mapelRecords)[number] | null = null;
	const agamaVariantRecords: typeof mapelRecords = [];
	const pksVariantRecords: typeof mapelRecords = [];
	const regularOptions: MapelOption[] = [];

	for (const record of mapelRecords) {
		if (isAgamaSubject(record.nama)) {
			if (normalizeText(record.nama) === normalizeText(AGAMA_BASE_SUBJECT)) {
				agamaBaseMapel = record;
			} else {
				agamaVariantRecords.push(record);
			}
		} else if (isPksSubject(record.nama)) {
			if (normalizeText(record.nama) === normalizeText(PKS_BASE_SUBJECT)) {
				pksBaseMapel = record;
			} else {
				pksVariantRecords.push(record);
			}
		} else {
			regularOptions.push({
				value: String(record.id),
				nama: record.namaLokal?.trim() || record.nama
			});
		}
	}

	regularOptions.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

	const mapelOptions: MapelOption[] = [...regularOptions];
	if (agamaBaseMapel || agamaVariantRecords.length) {
		const exists = mapelOptions.some(
			(option) => normalizeText(option.nama) === normalizeText(AGAMA_BASE_SUBJECT)
		);
		if (!exists) {
			mapelOptions.unshift({ value: AGAMA_MAPEL_VALUE, nama: AGAMA_BASE_SUBJECT });
		}
	}
	if (pksBaseMapel || pksVariantRecords.length) {
		const exists = mapelOptions.some(
			(option) => normalizeText(option.nama) === normalizeText(PKS_BASE_SUBJECT)
		);
		if (!exists) {
			mapelOptions.unshift({ value: PKS_MAPEL_VALUE, nama: PKS_BASE_SUBJECT });
		}
	}

	const requestedValue = url.searchParams.get('mapel_id');
	let selectedMapelValue = requestedValue ?? null;

	if (selectedMapelValue) {
		const requestedId = Number(selectedMapelValue);
		if (Number.isInteger(requestedId) && requestedId > 0) {
			const requestedRecord = mapelRecords.find((r) => r.id === requestedId);
			if (requestedRecord) {
				if (isAgamaSubject(requestedRecord.nama)) {
					selectedMapelValue = AGAMA_MAPEL_VALUE;
				} else if (isPksSubject(requestedRecord.nama)) {
					selectedMapelValue = PKS_MAPEL_VALUE;
				}
			}
		}
	}

	if (!selectedMapelValue && assignedLocalMapelId) {
		selectedMapelValue = String(assignedLocalMapelId);
	}
	if (selectedMapelValue && !mapelOptions.some((option) => option.value === selectedMapelValue)) {
		selectedMapelValue = null;
	}
	if (!selectedMapelValue && mapelOptions.length) {
		selectedMapelValue = mapelOptions[0].value;
	}

	const isAgamaSelected = selectedMapelValue === AGAMA_MAPEL_VALUE;
	const isPksSelected = selectedMapelValue === PKS_MAPEL_VALUE;
	const selectedMapelRecord =
		!isAgamaSelected && !isPksSelected && selectedMapelValue
			? (mapelRecords.find((record) => String(record.id) === selectedMapelValue) ?? null)
			: null;

	const selectedMapel = isAgamaSelected
		? agamaBaseMapel
			? { id: agamaBaseMapel.id, nama: agamaBaseMapel.nama }
			: { id: null, nama: AGAMA_BASE_SUBJECT }
		: isPksSelected
			? pksBaseMapel
				? { id: pksBaseMapel.id, nama: pksBaseMapel.nama }
				: { id: null, nama: PKS_BASE_SUBJECT }
			: selectedMapelRecord
				? {
						id: selectedMapelRecord.id,
						nama: selectedMapelRecord.namaLokal?.trim() || selectedMapelRecord.nama
					}
				: null;

	const muridFilter = and(
		eq(tableMurid.kelasId, kelasKontenAktif.id),
		search ? sql`${tableMurid.nama} LIKE ${'%' + search + '%'} COLLATE NOCASE` : undefined
	);

	const [{ totalItems }] = await db
		.select({ totalItems: sql<number>`count(*)` })
		.from(tableMurid)
		.where(muridFilter);

	const total = totalItems ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const currentPage = Math.min(Math.max(pageNumber, 1), totalPages);
	const offset = (currentPage - 1) * perPage;
	const pageState: PageState = {
		search,
		currentPage,
		totalPages,
		totalItems: total,
		perPage
	};

	const muridRecords = await db.query.tableMurid.findMany({
		columns: { id: true, nama: true, agama: true },
		where: muridFilter,
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

	const baseList: MuridRow[] = muridRecords.map((murid, index) => ({
		id: murid.id,
		no: offset + index + 1,
		nama: murid.nama,
		agamaLabel: null,
		mapelId: null,
		nilaiAkhirRts: null,
		nilaiAkhirAsli: null,
		nilaiRevisi: null,
		nilaiAkhir: null,
		naLingkup: null,
		sts: null,
		sas: null,
		nilaiHref: null,
		canNilai: true,
		tpScores: {}
	}));

	const teknikList = locals.sekolah?.id
		? await db.query.tableTeknikPenilaian.findMany({
				columns: { id: true, nama: true, singkatan: true },
				where: eq(tableTeknikPenilaian.sekolahId, locals.sekolah.id),
				orderBy: [asc(tableTeknikPenilaian.urutan), asc(tableTeknikPenilaian.nama)]
			})
		: [];

	if (!selectedMapelValue) {
		return {
			meta,
			kelasKontenAktif,
			mapelList: mapelOptions,
			selectedMapelValue,
			selectedMapel,
			relevantMapelIds: [] as number[],
			daftarMurid: baseList,
			tujuanList: [],
			teknikList,
			page: pageState
		};
	}

	const agamaMapelIds = [
		...agamaVariantRecords.map((record) => record.id),
		...(agamaBaseMapel ? [agamaBaseMapel.id] : [])
	];
	const pksMapelIds = [
		...pksVariantRecords.map((record) => record.id),
		...(pksBaseMapel ? [pksBaseMapel.id] : [])
	];
	const relevantMapelIds = isAgamaSelected
		? Array.from(new Set(agamaMapelIds))
		: isPksSelected
			? Array.from(new Set(pksMapelIds))
			: selectedMapelRecord
				? [selectedMapelRecord.id]
				: [];

	const muridIds = muridRecords.map((murid) => murid.id);

	const sumatifRecords =
		relevantMapelIds.length && muridIds.length
			? await db.query.tableAsesmenSumatif.findMany({
					columns: {
						muridId: true,
						mataPelajaranId: true,
						naLingkup: true,
						sts: true,
						sas: true,
						nilaiAkhirAsli: true,
						nilaiRevisi: true,
						nilaiAkhir: true,
						nilaiAkhirRts: true
					},
					where: and(
						inArray(tableAsesmenSumatif.mataPelajaranId, relevantMapelIds),
						inArray(tableAsesmenSumatif.muridId, muridIds)
					)
				})
			: [];

	const sumatifByMurid = new Map<number, Map<number, (typeof sumatifRecords)[number]>>();
	for (const record of sumatifRecords) {
		let map = sumatifByMurid.get(record.muridId);
		if (!map) {
			map = new Map();
			sumatifByMurid.set(record.muridId, map);
		}
		map.set(record.mataPelajaranId, record);
	}

	const tujuanRecords = relevantMapelIds.length
		? await db.query.tableTujuanPembelajaran.findMany({
				where: inArray(tableTujuanPembelajaran.mataPelajaranId, relevantMapelIds),
				with: {
					teknikPenilaian: true
				},
				orderBy: [asc(tableTujuanPembelajaran.id)]
			})
		: [];

	const sumatifTujuanRecords =
		relevantMapelIds.length && muridIds.length
			? await db.query.tableAsesmenSumatifTujuan.findMany({
					where: and(
						inArray(tableAsesmenSumatifTujuan.mataPelajaranId, relevantMapelIds),
						inArray(tableAsesmenSumatifTujuan.muridId, muridIds)
					)
				})
			: [];

	const tpScoresByMurid = new Map<number, Record<number, number | null>>();
	for (const st of sumatifTujuanRecords) {
		let m = tpScoresByMurid.get(st.muridId);
		if (!m) {
			m = {};
			tpScoresByMurid.set(st.muridId, m);
		}
		m[st.tujuanPembelajaranId] = st.nilai != null ? Number(st.nilai) : null;
	}

	const tujuanList = tujuanRecords.map((t, idx) => ({
		id: t.id,
		no: idx + 1,
		mataPelajaranId: t.mataPelajaranId,
		deskripsi: t.deskripsi,
		lingkupMateri: t.lingkupMateri,
		bobot: effectiveColumnBobot(t.bobot),
		jenisAsesmen: parseJenisAsesmen(t.jenisAsesmen),
		teknikPenilaianId: t.teknikPenilaianId,
		teknikNama: t.teknikPenilaian?.nama ?? null,
		teknikSingkatan: t.teknikPenilaian?.singkatan ?? null
	}));

	const kunciNilai = relevantMapelIds.length ? await loadKunciNilai(relevantMapelIds) : new Map();
	const isTerkunci = selectedMapelRecord
		? kunciNilai.has(selectedMapelRecord.id)
		: relevantMapelIds.some((id) => kunciNilai.has(id));

	const konfigurasiSekolah = konfigurasiNilaiDariSekolah(locals.sekolah ?? null);
	const primaryMapel =
		selectedMapelRecord ?? (relevantMapelIds.length ? mapelById.get(relevantMapelIds[0]) : null);
	const primaryBobot = bobotMapelEfektif(primaryMapel, konfigurasiSekolah);

	const pickMapelIdForMurid = (muridAgama: string | null | undefined): number | null => {
		if (isAgamaSelected) {
			const variantName = resolveAgamaVariantName(muridAgama);
			if (variantName) {
				const variantRecord = mapelByName.get(normalizeText(variantName));
				if (variantRecord) {
					return variantRecord.id;
				}
			}
			return agamaBaseMapel?.id ?? null;
		}
		if (isPksSelected) {
			const variantName = resolvePksVariantName(muridAgama);
			if (variantName) {
				const variantRecord = mapelByName.get(normalizeText(variantName));
				if (variantRecord) {
					return variantRecord.id;
				}
			}
			return pksBaseMapel?.id ?? null;
		}
		return selectedMapelRecord?.id ?? null;
	};

	const daftarMurid: MuridRow[] = muridRecords.map((murid, index) => {
		const targetMapelId = pickMapelIdForMurid(murid.agama);
		const agamaLabel =
			isAgamaSelected || isPksSelected
				? labelVarianUntukMurid(selectedMapel?.nama ?? '', murid.agama)
				: null;
		const sumatif = targetMapelId
			? (sumatifByMurid.get(murid.id)?.get(targetMapelId) ?? null)
			: null;

		const canAccess = (() => {
			if (!maybeUser || maybeUser.type !== 'user') return true;
			if (kelasKontenAktif?.id != null && guruOwnKelasIds?.includes(kelasKontenAktif.id))
				return true;

			if ((isAgamaSelected || isPksSelected) && allowedAgamaVariants.size > 0) {
				const label = labelVarianUntukMurid(selectedMapel?.nama ?? '', murid.agama);
				return !!label && allowedAgamaVariants.has(label);
			}

			if (!assignedIsAgamaVariant) return true;
			if (!assignedLocalMapelId) return false;
			return targetMapelId === assignedLocalMapelId;
		})();

		if (!canAccess) {
			return {
				id: murid.id,
				no: offset + index + 1,
				nama: murid.nama,
				agamaLabel,
				mapelId: targetMapelId,
				nilaiAkhirRts: null,
				nilaiAkhirAsli: null,
				nilaiRevisi: null,
				nilaiAkhir: null,
				naLingkup: null,
				sts: null,
				sas: null,
				nilaiHref: null,
				canNilai: false,
				diisiUserLain: true,
				tpScores: {}
			};
		}

		const studentMapel = targetMapelId ? mapelById.get(targetMapelId) : primaryMapel;
		const studentBobot = bobotMapelEfektif(studentMapel, konfigurasiSekolah);
		const computedAsli =
			hitungNilaiAkhirSumatif(
				{
					naLingkup: sumatif?.naLingkup ?? null,
					sts: sumatif?.sts ?? null,
					sas: sumatif?.sas ?? null
				},
				studentBobot.bobotAkhir
			) ??
			sumatif?.nilaiAkhirAsli ??
			null;
		const revisi = sumatif?.nilaiRevisi ?? null;
		const efektifAkhir = nilaiEfektifAkhir(computedAsli, revisi) ?? sumatif?.nilaiAkhir ?? null;
		const computedRts =
			hitungNilaiAkhirRts(
				{ naLingkup: sumatif?.naLingkup ?? null, sts: sumatif?.sts ?? null },
				studentBobot.bobotRts
			) ??
			sumatif?.nilaiAkhirRts ??
			null;

		return {
			id: murid.id,
			no: offset + index + 1,
			nama: murid.nama,
			agamaLabel,
			mapelId: targetMapelId,
			nilaiAkhirRts: formatScore(computedRts),
			nilaiAkhirAsli: formatScore(computedAsli),
			nilaiRevisi: formatScore(revisi),
			nilaiAkhir: formatScore(efektifAkhir),
			naLingkup: formatScore(sumatif?.naLingkup),
			sts: formatScore(sumatif?.sts),
			sas: formatScore(sumatif?.sas),
			nilaiHref:
				targetMapelId && canAccess
					? `/asesmen-sumatif/formulir-asesmen?kelas=${kelasKontenAktif.id}&murid_id=${murid.id}&mapel_id=${targetMapelId}`
					: null,
			canNilai: Boolean(canAccess),
			tpScores: tpScoresByMurid.get(murid.id) ?? {}
		};
	});

	return {
		meta,
		kelasKontenAktif,
		mapelList: mapelOptions,
		selectedMapelValue,
		selectedMapel,
		relevantMapelIds,
		daftarMurid,
		tujuanList,
		teknikList,
		kkm: selectedMapelRecord?.kkm ?? 75,
		isTerkunci,
		sumatifWeights: {
			lingkup: primaryBobot.bobotAkhir.lingkup,
			sts: primaryBobot.bobotAkhir.sts,
			sas: primaryBobot.bobotAkhir.sas,
			isCustom: primaryBobot.isCustom,
			sekolahDefault: konfigurasiSekolah.bobotAkhir,
			rts: primaryBobot.bobotRts
		},
		allowedAgamaForUser,
		page: pageState
	};
}

type BulkNilaiItem = { muridId: number; mapelId: number };

function parseBulkItems(raw: FormDataEntryValue | null): BulkNilaiItem[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(String(raw ?? '[]'));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	const seen = new Set<string>();
	const items: BulkNilaiItem[] = [];
	for (const entry of parsed) {
		const record = entry as { muridId?: unknown; mapelId?: unknown } | null;
		const muridId = Number(record?.muridId);
		const mapelId = Number(record?.mapelId);
		if (!Number.isInteger(muridId) || muridId <= 0) continue;
		if (!Number.isInteger(mapelId) || mapelId <= 0) continue;
		const key = `${muridId}|${mapelId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		items.push({ muridId, mapelId });
	}
	return items;
}

const BULK_KOMPONEN_LABEL: Record<'lingkup' | 'sts' | 'sas', string> = {
	lingkup: 'Formatif (F)',
	sts: 'Sumatif (S)',
	sas: 'Sumatif AS (AS)'
};

export const actions = {
	/**
	 * Simpan seluruh nilai matriks terpadu satu kelas (Formatif F, Sumatif S,
	 * Sumatif AS, dan kolom Revisi).
	 */
	simpanMatriks: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();

		const formData = await request.formData();
		const payloadRaw = formData.get('payload');
		if (!payloadRaw) return fail(400, { fail: 'Data nilai kosong.' });

		let rows: Array<{
			muridId: number;
			mapelId: number;
			tpScores?: Record<string, number | null>;
			legacySts?: number | null;
			legacySas?: number | null;
			sts?: number | null;
			sas?: number | null;
			nilaiRevisi?: number | null;
		}>;
		try {
			rows = JSON.parse(String(payloadRaw));
		} catch {
			return fail(400, { fail: 'Format data matriks tidak valid.' });
		}

		if (!Array.isArray(rows) || !rows.length) {
			return fail(400, { fail: 'Pilih minimal satu murid untuk disimpan.' });
		}

		const uniqueMapelIds = [...new Set(rows.map((r) => r.mapelId).filter(Boolean))];
		const auth = await assertCanEditMapels(locals as ActionLocals, uniqueMapelIds);
		if (auth.error) return auth.error;

		const konfigurasiSekolah = konfigurasiNilaiDariSekolah(locals.sekolah ?? null);

		const tujuanRows = await queryInChunks(uniqueMapelIds, (ids) =>
			db
				.select({
					id: tableTujuanPembelajaran.id,
					mataPelajaranId: tableTujuanPembelajaran.mataPelajaranId,
					jenisAsesmen: tableTujuanPembelajaran.jenisAsesmen,
					bobot: tableTujuanPembelajaran.bobot
				})
				.from(tableTujuanPembelajaran)
				.where(inArray(tableTujuanPembelajaran.mataPelajaranId, ids))
		);

		const tujuanByMapel = new Map<
			number,
			{
				allIds: Set<number>;
				formatif: Array<{ id: number; bobot: number }>;
				sumatif: Array<{ id: number; bobot: number }>;
				as: Array<{ id: number; bobot: number }>;
			}
		>();
		for (const t of tujuanRows) {
			let bucket = tujuanByMapel.get(t.mataPelajaranId);
			if (!bucket) {
				bucket = { allIds: new Set(), formatif: [], sumatif: [], as: [] };
				tujuanByMapel.set(t.mataPelajaranId, bucket);
			}
			bucket.allIds.add(t.id);
			const jenis = parseJenisAsesmen(t.jenisAsesmen);
			bucket[jenis].push({ id: t.id, bobot: t.bobot ?? 0 });
		}

		const uniqueMuridIds = [...new Set(rows.map((r) => r.muridId).filter(Boolean))];
		const validMuridRows = uniqueMuridIds.length
			? await queryInChunks(uniqueMuridIds, (mIds) =>
					db
						.select({ id: tableMurid.id, kelasId: tableMurid.kelasId })
						.from(tableMurid)
						.where(and(eq(tableMurid.sekolahId, auth.sekolahId), inArray(tableMurid.id, mIds)))
				)
			: [];
		const muridKelasById = new Map(validMuridRows.map((m) => [m.id, m.kelasId]));

		const existingSumatifRows =
			uniqueMuridIds.length && uniqueMapelIds.length
				? await queryInChunks(uniqueMuridIds, (mIds) =>
						db
							.select({
								muridId: tableAsesmenSumatif.muridId,
								mataPelajaranId: tableAsesmenSumatif.mataPelajaranId,
								naLingkup: tableAsesmenSumatif.naLingkup,
								sts: tableAsesmenSumatif.sts,
								sas: tableAsesmenSumatif.sas
							})
							.from(tableAsesmenSumatif)
							.where(
								and(
									inArray(tableAsesmenSumatif.muridId, mIds),
									inArray(tableAsesmenSumatif.mataPelajaranId, uniqueMapelIds)
								)
							)
					)
				: [];
		const existingByKey = new Map(
			existingSumatifRows.map((r) => [`${r.muridId}|${r.mataPelajaranId}`, r])
		);

		const nowIso = new Date().toISOString();

		for (const row of rows) {
			const muridId = Number(row.muridId);
			const mapelId = Number(row.mapelId);
			if (
				!Number.isInteger(muridId) ||
				!Number.isInteger(mapelId) ||
				muridId <= 0 ||
				mapelId <= 0
			) {
				continue;
			}

			const mapel = auth.mapelById.get(mapelId);
			if (!mapel) continue;
			if (muridKelasById.get(muridId) !== mapel.kelasId) continue;

			const cols = tujuanByMapel.get(mapelId) ?? {
				allIds: new Set<number>(),
				formatif: [],
				sumatif: [],
				as: []
			};
			const existing = existingByKey.get(`${muridId}|${mapelId}`);
			const parsedScores = new Map<number, number>();

			if (row.tpScores && typeof row.tpScores === 'object') {
				for (const [tpIdStr, scoreRaw] of Object.entries(row.tpScores)) {
					const tpId = Number(tpIdStr);
					if (!Number.isInteger(tpId) || !cols.allIds.has(tpId)) continue;
					const score = sanitizeScore(scoreRaw);

					if (score != null) {
						parsedScores.set(tpId, score);
						await db
							.insert(tableAsesmenSumatifTujuan)
							.values({
								muridId,
								mataPelajaranId: mapelId,
								tujuanPembelajaranId: tpId,
								nilai: score,
								createdAt: nowIso,
								updatedAt: nowIso
							})
							.onConflictDoUpdate({
								target: [
									tableAsesmenSumatifTujuan.muridId,
									tableAsesmenSumatifTujuan.tujuanPembelajaranId
								],
								set: {
									nilai: score,
									mataPelajaranId: mapelId,
									updatedAt: nowIso
								}
							});
					} else {
						await db
							.delete(tableAsesmenSumatifTujuan)
							.where(
								and(
									eq(tableAsesmenSumatifTujuan.muridId, muridId),
									eq(tableAsesmenSumatifTujuan.tujuanPembelajaranId, tpId)
								)
							);
					}
				}
			}

			const naLingkup =
				cols.formatif.length > 0
					? hitungRataBerbobot(
							cols.formatif.map((c) => ({ nilai: parsedScores.get(c.id), bobot: c.bobot }))
						)
					: (existing?.naLingkup ?? null);

			const sts =
				cols.sumatif.length > 0
					? hitungRataBerbobot(
							cols.sumatif.map((c) => ({ nilai: parsedScores.get(c.id), bobot: c.bobot }))
						)
					: sanitizeScore(row.legacySts !== undefined ? row.legacySts : row.sts);

			const sas =
				cols.as.length > 0
					? hitungRataBerbobot(
							cols.as.map((c) => ({ nilai: parsedScores.get(c.id), bobot: c.bobot }))
						)
					: sanitizeScore(row.legacySas !== undefined ? row.legacySas : row.sas);

			const mapelBobot = bobotMapelEfektif(mapel, konfigurasiSekolah);
			const nilaiAkhirAsli = hitungNilaiAkhirSumatif(
				{ naLingkup, sts, sas },
				mapelBobot.bobotAkhir
			);
			const nilaiRevisi = sanitizeScore(row.nilaiRevisi);
			const nilaiAkhir = nilaiEfektifAkhir(nilaiAkhirAsli, nilaiRevisi);
			const nilaiAkhirRts = hitungNilaiAkhirRts({ naLingkup, sts }, mapelBobot.bobotRts);

			await db
				.insert(tableAsesmenSumatif)
				.values({
					muridId,
					mataPelajaranId: mapelId,
					naLingkup,
					sts,
					sas,
					nilaiAkhirAsli,
					nilaiRevisi,
					nilaiAkhir,
					nilaiAkhirRts,
					createdAt: nowIso,
					updatedAt: nowIso
				})
				.onConflictDoUpdate({
					target: [tableAsesmenSumatif.muridId, tableAsesmenSumatif.mataPelajaranId],
					set: {
						naLingkup,
						sts,
						sas,
						nilaiAkhirAsli,
						nilaiRevisi,
						nilaiAkhir,
						nilaiAkhirRts,
						updatedAt: nowIso
					}
				});
		}

		return {
			success: true,
			message: `Berhasil menyimpan nilai untuk ${rows.length} murid.`
		};
	},

	/**
	 * Tambah kolom asesmen baru pada kelompok Formatif (F), Sumatif (S), atau Sumatif AS (AS).
	 * Jika kelompok S/AS baru pertama kali punya kolom dinamis namun sebelumnya sudah ada nilai
	 * legacy `sts`/`sas`, nilai lama otomatis dipindahkan agar tidak hilang.
	 */
	tambahKolom: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();
		const formData = await request.formData();

		const mapelId = Number(formData.get('mapelId'));
		const jenisAsesmen = parseJenisAsesmen(formData.get('jenisAsesmen'));
		const lingkupMateri = String(formData.get('lingkupMateri') ?? '').trim();
		const deskripsi = String(formData.get('deskripsi') ?? '').trim();
		const bobotRaw = Number(String(formData.get('bobot') ?? '1').replace(',', '.'));
		const teknikRaw = formData.get('teknikPenilaianId');
		const teknikPenilaianId =
			teknikRaw && Number.isInteger(Number(teknikRaw)) && Number(teknikRaw) > 0
				? Number(teknikRaw)
				: null;
		const materializeLegacy = String(formData.get('materializeLegacy') ?? '') === '1';

		if (!Number.isInteger(mapelId) || mapelId <= 0) {
			return fail(400, { fail: 'Pilih mata pelajaran terlebih dahulu.' });
		}
		if (!deskripsi) {
			return fail(400, { fail: 'Deskripsi tujuan pembelajaran / keterangan wajib diisi.' });
		}
		if (!Number.isFinite(bobotRaw) || bobotRaw <= 0 || bobotRaw > 100) {
			return fail(400, { fail: 'Bobot kolom harus lebih dari 0 (maksimal 100).' });
		}

		const auth = await assertCanEditMapels(locals as ActionLocals, [mapelId]);
		if (auth.error) return auth.error;

		const bobot = Math.round(bobotRaw * 100) / 100;
		const defaultLabel =
			jenisAsesmen === 'sumatif' ? 'Sumatif' : jenisAsesmen === 'as' ? 'AS' : 'Formatif';
		const finalLabel = lingkupMateri || defaultLabel;
		const nowIso = new Date().toISOString();

		// Cek migrasi nilai legacy STS / SAS bila kolom S / AS masih 0 di tujuan_pembelajaran.
		if (jenisAsesmen === 'sumatif' || jenisAsesmen === 'as') {
			const existingGroupCols = await db
				.select({ id: tableTujuanPembelajaran.id })
				.from(tableTujuanPembelajaran)
				.where(
					and(
						eq(tableTujuanPembelajaran.mataPelajaranId, mapelId),
						eq(tableTujuanPembelajaran.jenisAsesmen, jenisAsesmen)
					)
				);

			if (existingGroupCols.length === 0) {
				const legacyRows = await db
					.select({
						muridId: tableAsesmenSumatif.muridId,
						sts: tableAsesmenSumatif.sts,
						sas: tableAsesmenSumatif.sas
					})
					.from(tableAsesmenSumatif)
					.where(eq(tableAsesmenSumatif.mataPelajaranId, mapelId));

				const populatedLegacy = legacyRows
					.map((r) => ({
						muridId: r.muridId,
						score: jenisAsesmen === 'sumatif' ? r.sts : r.sas
					}))
					.filter((r): r is { muridId: number; score: number } => r.score != null);

				if (materializeLegacy) {
					const [inserted] = await db
						.insert(tableTujuanPembelajaran)
						.values({
							mataPelajaranId: mapelId,
							lingkupMateri: finalLabel,
							deskripsi,
							bobot,
							jenisAsesmen,
							teknikPenilaianId,
							createdAt: nowIso,
							updatedAt: nowIso
						})
						.returning({ id: tableTujuanPembelajaran.id });

					if (inserted && populatedLegacy.length > 0) {
						for (const item of populatedLegacy) {
							await db
								.insert(tableAsesmenSumatifTujuan)
								.values({
									muridId: item.muridId,
									mataPelajaranId: mapelId,
									tujuanPembelajaranId: inserted.id,
									nilai: item.score,
									createdAt: nowIso,
									updatedAt: nowIso
								})
								.onConflictDoUpdate({
									target: [
										tableAsesmenSumatifTujuan.muridId,
										tableAsesmenSumatifTujuan.tujuanPembelajaranId
									],
									set: { nilai: item.score, updatedAt: nowIso }
								});
						}
					}

					await recalcMapelSumatifScores([mapelId], locals.sekolah ?? null);
					return {
						success: true,
						id: inserted?.id ?? null,
						message: 'Kolom penilaian berhasil diperbarui.'
					};
				}

				// Tambah kolom baru ketika sudah ada nilai legacy: amankan nilai legacy di kolom 1 dulu.
				if (populatedLegacy.length > 0) {
					const [preserved] = await db
						.insert(tableTujuanPembelajaran)
						.values({
							mataPelajaranId: mapelId,
							lingkupMateri: jenisAsesmen === 'sumatif' ? 'Sumatif 1' : 'AS 1',
							deskripsi:
								jenisAsesmen === 'sumatif'
									? 'Sumatif Tengah Semester / Lingkup'
									: 'Sumatif Akhir Semester',
							bobot: 1,
							jenisAsesmen,
							createdAt: nowIso,
							updatedAt: nowIso
						})
						.returning({ id: tableTujuanPembelajaran.id });

					if (preserved) {
						for (const item of populatedLegacy) {
							await db.insert(tableAsesmenSumatifTujuan).values({
								muridId: item.muridId,
								mataPelajaranId: mapelId,
								tujuanPembelajaranId: preserved.id,
								nilai: item.score,
								createdAt: nowIso,
								updatedAt: nowIso
							});
						}
					}
				}
			}
		}

		const [created] = await db
			.insert(tableTujuanPembelajaran)
			.values({
				mataPelajaranId: mapelId,
				lingkupMateri: finalLabel,
				deskripsi,
				bobot,
				jenisAsesmen,
				teknikPenilaianId,
				createdAt: nowIso,
				updatedAt: nowIso
			})
			.returning({ id: tableTujuanPembelajaran.id });

		await recalcMapelSumatifScores([mapelId], locals.sekolah ?? null);

		return {
			success: true,
			id: created?.id ?? null,
			message: 'Kolom penilaian berhasil ditambahkan.'
		};
	},

	/**
	 * Ubah detail atau bobot satu kolom penilaian langsung dari header matriks.
	 */
	ubahKolom: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();
		const formData = await request.formData();

		const id = Number(formData.get('id'));
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'Kolom penilaian tidak valid.' });
		}

		const existing = await db.query.tableTujuanPembelajaran.findFirst({
			where: eq(tableTujuanPembelajaran.id, id)
		});
		if (!existing) {
			return fail(404, { fail: 'Kolom penilaian tidak ditemukan.' });
		}

		const auth = await assertCanEditMapels(locals as ActionLocals, [existing.mataPelajaranId]);
		if (auth.error) return auth.error;

		const bobotRaw = Number(
			String(formData.get('bobot') ?? effectiveColumnBobot(existing.bobot)).replace(',', '.')
		);
		if (!Number.isFinite(bobotRaw) || bobotRaw <= 0 || bobotRaw > 100) {
			return fail(400, { fail: 'Bobot kolom harus lebih dari 0 (maksimal 100).' });
		}

		const lingkupRaw = formData.get('lingkupMateri');
		const deskripsiRaw = formData.get('deskripsi');
		const teknikRaw = formData.get('teknikPenilaianId');

		const lingkupMateri =
			lingkupRaw != null
				? String(lingkupRaw).trim() || existing.lingkupMateri
				: existing.lingkupMateri;
		const deskripsi = deskripsiRaw != null ? String(deskripsiRaw).trim() : existing.deskripsi;
		if (!deskripsi) {
			return fail(400, { fail: 'Deskripsi tujuan pembelajaran wajib diisi.' });
		}

		const teknikPenilaianId =
			teknikRaw !== null
				? Number.isInteger(Number(teknikRaw)) && Number(teknikRaw) > 0
					? Number(teknikRaw)
					: null
				: existing.teknikPenilaianId;

		await db
			.update(tableTujuanPembelajaran)
			.set({
				lingkupMateri,
				deskripsi,
				bobot: Math.round(bobotRaw * 100) / 100,
				teknikPenilaianId,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableTujuanPembelajaran.id, id));

		await recalcMapelSumatifScores([existing.mataPelajaranId], locals.sekolah ?? null);

		return {
			success: true,
			message: 'Kolom penilaian berhasil diperbarui.'
		};
	},

	/**
	 * Hapus satu kolom penilaian beserta seluruh nilainya, lalu hitung ulang NA dan AKHIR.
	 */
	hapusKolom: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();
		const formData = await request.formData();

		const id = Number(formData.get('id'));
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'Kolom penilaian tidak valid.' });
		}

		const existing = await db.query.tableTujuanPembelajaran.findFirst({
			where: eq(tableTujuanPembelajaran.id, id)
		});
		if (!existing) {
			return fail(404, { fail: 'Kolom penilaian tidak ditemukan.' });
		}

		const auth = await assertCanEditMapels(locals as ActionLocals, [existing.mataPelajaranId]);
		if (auth.error) return auth.error;

		const jenis = parseJenisAsesmen(existing.jenisAsesmen);

		await db
			.delete(tableAsesmenSumatifTujuan)
			.where(eq(tableAsesmenSumatifTujuan.tujuanPembelajaranId, id));
		await db.delete(tableTujuanPembelajaran).where(eq(tableTujuanPembelajaran.id, id));

		// Jika kolom terakhir di kelompok ini baru dihapus, bersihkan agregat kelompoknya.
		const remaining = await db
			.select({ id: tableTujuanPembelajaran.id })
			.from(tableTujuanPembelajaran)
			.where(
				and(
					eq(tableTujuanPembelajaran.mataPelajaranId, existing.mataPelajaranId),
					eq(tableTujuanPembelajaran.jenisAsesmen, jenis)
				)
			);

		if (remaining.length === 0) {
			const resetPatch =
				jenis === 'sumatif' ? { sts: null } : jenis === 'as' ? { sas: null } : { naLingkup: null };
			await db
				.update(tableAsesmenSumatif)
				.set(resetPatch)
				.where(eq(tableAsesmenSumatif.mataPelajaranId, existing.mataPelajaranId));
		}

		await recalcMapelSumatifScores([existing.mataPelajaranId], locals.sekolah ?? null);

		return {
			success: true,
			message: 'Kolom penilaian berhasil dihapus.'
		};
	},

	/**
	 * Simpan bobot kelompok Formatif (F) / Sumatif (S) / Sumatif AS (AS) khusus mapel ini,
	 * atau reset ke default sekolah.
	 */
	simpanBobotMapel: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();
		const formData = await request.formData();

		let mapelIds: number[] = [];
		const mapelIdsRaw = formData.get('mapelIds');
		if (mapelIdsRaw) {
			try {
				const parsed = JSON.parse(String(mapelIdsRaw));
				if (Array.isArray(parsed)) {
					mapelIds = parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
				}
			} catch {
				// fall back to single mapelId
			}
		}
		if (!mapelIds.length) {
			const single = Number(formData.get('mapelId'));
			if (Number.isInteger(single) && single > 0) mapelIds = [single];
		}

		const auth = await assertCanEditMapels(locals as ActionLocals, mapelIds);
		if (auth.error) return auth.error;

		const reset = String(formData.get('reset') ?? '') === '1';
		const nowIso = new Date().toISOString();

		if (reset) {
			await db
				.update(tableMataPelajaran)
				.set({
					bobotFormatif: null,
					bobotSumatif: null,
					bobotAs: null,
					updatedAt: nowIso
				})
				.where(inArray(tableMataPelajaran.id, mapelIds));

			await recalcMapelSumatifScores(mapelIds, locals.sekolah ?? null);
			return {
				success: true,
				message: 'Bobot mapel dikembalikan mengikuti default sekolah.'
			};
		}

		const bobotFormatif = Math.round(Number(formData.get('bobotFormatif')));
		const bobotSumatif = Math.round(Number(formData.get('bobotSumatif')));
		const bobotAs = Math.round(Number(formData.get('bobotAs')));

		if (
			!Number.isFinite(bobotFormatif) ||
			!Number.isFinite(bobotSumatif) ||
			!Number.isFinite(bobotAs) ||
			bobotFormatif < 0 ||
			bobotSumatif < 0 ||
			bobotAs < 0
		) {
			return fail(400, { fail: 'Semua nilai bobot harus angka 0 sampai 100.' });
		}

		if (bobotFormatif + bobotSumatif + bobotAs !== 100) {
			return fail(400, {
				fail: `Jumlah bobot F + S + AS harus 100% (saat ini ${bobotFormatif + bobotSumatif + bobotAs}%).`
			});
		}

		await db
			.update(tableMataPelajaran)
			.set({
				bobotFormatif,
				bobotSumatif,
				bobotAs,
				updatedAt: nowIso
			})
			.where(inArray(tableMataPelajaran.id, mapelIds));

		await recalcMapelSumatifScores(mapelIds, locals.sekolah ?? null);

		return {
			success: true,
			message: `Bobot mapel diperbarui (${bobotFormatif}% F / ${bobotSumatif}% S / ${bobotAs}% AS).`
		};
	},

	/**
	 * Isi satu komponen nilai untuk banyak murid sekaligus ("Isi Sekaligus").
	 */
	simpanMassal: async ({ request, locals }) => {
		await ensureAsesmenSumatifSchema();

		const formData = await request.formData();
		const items = parseBulkItems(formData.get('items'));
		if (!items.length) return fail(400, { fail: 'Pilih minimal satu murid.' });
		if (items.length > 300) {
			return fail(400, { fail: 'Maksimal 300 murid per sekali simpan.' });
		}

		const komponenRaw = String(formData.get('komponen') ?? '');
		if (komponenRaw !== 'lingkup' && komponenRaw !== 'sts' && komponenRaw !== 'sas') {
			return fail(400, { fail: 'Komponen nilai tidak valid.' });
		}
		const komponen = komponenRaw;

		const nilaiRaw = String(formData.get('nilai') ?? '').trim();
		if (!nilaiRaw) return fail(400, { fail: 'Nilai wajib diisi.' });
		const normalized = nilaiRaw.replace(',', '.');
		if (!/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(normalized)) {
			return fail(400, { fail: 'Nilai harus 0-100 dengan maksimal 2 desimal.' });
		}
		const nilai = Math.round(Number.parseFloat(normalized) * 100) / 100;

		const muridIds = [...new Set(items.map((item) => item.muridId))];
		const mapelIds = [...new Set(items.map((item) => item.mapelId))];

		const auth = await assertCanEditMapels(locals as ActionLocals, mapelIds);
		if (auth.error) return auth.error;

		const muridRows = await queryInChunks(muridIds, (ids) =>
			db
				.select({ id: tableMurid.id, kelasId: tableMurid.kelasId })
				.from(tableMurid)
				.where(and(eq(tableMurid.sekolahId, auth.sekolahId), inArray(tableMurid.id, ids)))
		);
		const muridKelas = new Map(muridRows.map((row) => [row.id, row.kelasId]));

		const valid = items.filter((item) => {
			const kelasId = muridKelas.get(item.muridId);
			const mapel = auth.mapelById.get(item.mapelId);
			return kelasId != null && mapel != null && mapel.kelasId === kelasId;
		});
		if (!valid.length) {
			return fail(400, { fail: 'Tidak ada pasangan murid dan mata pelajaran yang valid.' });
		}

		const uniqueMapelIds = [...new Set(valid.map((item) => item.mapelId))];
		const nilaiLama = new Map<
			string,
			{
				naLingkup: number | null;
				sts: number | null;
				sas: number | null;
				nilaiRevisi: number | null;
			}
		>();
		for (const mapelId of uniqueMapelIds) {
			const ids = valid.filter((item) => item.mapelId === mapelId).map((item) => item.muridId);
			await queryInChunks(ids, async (part) => {
				const rows = await db.query.tableAsesmenSumatif.findMany({
					columns: {
						muridId: true,
						naLingkup: true,
						sts: true,
						sas: true,
						nilaiRevisi: true
					},
					where: and(
						eq(tableAsesmenSumatif.mataPelajaranId, mapelId),
						inArray(tableAsesmenSumatif.muridId, part)
					)
				});
				for (const row of rows) {
					nilaiLama.set(`${row.muridId}|${mapelId}`, {
						naLingkup: row.naLingkup,
						sts: row.sts,
						sas: row.sas,
						nilaiRevisi: row.nilaiRevisi
					});
				}
				return rows;
			});
		}

		const konfigurasi = konfigurasiNilaiDariSekolah(locals.sekolah ?? null);
		const now = new Date().toISOString();
		const values = valid.map((item) => {
			const lama = nilaiLama.get(`${item.muridId}|${item.mapelId}`);
			const mapel = auth.mapelById.get(item.mapelId);
			const mapelBobot = bobotMapelEfektif(mapel, konfigurasi);
			const naLingkup = komponen === 'lingkup' ? nilai : (lama?.naLingkup ?? null);
			const sts = komponen === 'sts' ? nilai : (lama?.sts ?? null);
			const sas = komponen === 'sas' ? nilai : (lama?.sas ?? null);
			const nilaiAkhirAsli = hitungNilaiAkhirSumatif(
				{ naLingkup, sts, sas },
				mapelBobot.bobotAkhir
			);
			const nilaiRevisi = lama?.nilaiRevisi ?? null;
			return {
				muridId: item.muridId,
				mataPelajaranId: item.mapelId,
				naLingkup,
				sts,
				sas,
				nilaiAkhirAsli,
				nilaiRevisi,
				nilaiAkhir: nilaiEfektifAkhir(nilaiAkhirAsli, nilaiRevisi),
				nilaiAkhirRts: hitungNilaiAkhirRts({ naLingkup, sts }, mapelBobot.bobotRts),
				updatedAt: now
			};
		});

		for (const part of chunk(values, 8)) {
			await db
				.insert(tableAsesmenSumatif)
				.values(part)
				.onConflictDoUpdate({
					target: [tableAsesmenSumatif.muridId, tableAsesmenSumatif.mataPelajaranId],
					set: {
						naLingkup: sql`excluded.na_lingkup`,
						sts: sql`excluded.sts`,
						sas: sql`excluded.sas`,
						nilaiAkhirAsli: sql`excluded.nilai_akhir_asli`,
						nilaiAkhir: sql`excluded.nilai_akhir`,
						nilaiAkhirRts: sql`excluded.nilai_akhir_rts`,
						updatedAt: now
					}
				});
		}

		return {
			message: `${values.length} murid diperbarui: ${BULK_KOMPONEN_LABEL[komponen]} = ${nilai}.`
		};
	}
};
