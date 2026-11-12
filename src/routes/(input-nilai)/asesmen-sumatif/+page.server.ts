import db from '$lib/server/db';
import { ensureAsesmenSumatifSchema } from '$lib/server/db/ensure-asesmen-sumatif';
import { queryInChunks, chunk } from '$lib/server/db/chunk';
import {
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
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
	konfigurasiNilaiDariSekolah,
	hitungNilaiAkhirRts,
	hitungNilaiAkhirSumatif
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
	// Ejaan mengikuti $lib/statics (sumber nama baris DB) agar pencocokan
	// mapelByName selalu cocok — termasuk varian Konghuchu & Kepercayaan.
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

function computeNilaiAkhir(
	naLingkup: number | null | undefined,
	sts: number | null | undefined,
	sas: number | null | undefined,
	bobotLingkup: number,
	bobotSts: number,
	bobotSas: number
) {
	const eff =
		sts == null
			? { lingkup: 70, sts: 0, sas: 30 }
			: { lingkup: bobotLingkup, sts: bobotSts, sas: bobotSas };
	let weighted = 0;
	let totalW = 0;
	if (naLingkup != null) {
		weighted += naLingkup * eff.lingkup;
		totalW += eff.lingkup;
	}
	if (sts != null) {
		weighted += sts * eff.sts;
		totalW += eff.sts;
	}
	if (sas != null) {
		weighted += sas * eff.sas;
		totalW += eff.sas;
	}
	if (totalW === 0) return null;
	return Math.round((weighted / totalW) * 100) / 100;
}

function computeNilaiAkhirRts(
	naLingkup: number | null | undefined,
	sts: number | null | undefined,
	bobotLingkup: number,
	bobotSts: number
) {
	let weighted = 0;
	let totalW = 0;
	if (naLingkup != null) {
		weighted += naLingkup * bobotLingkup;
		totalW += bobotLingkup;
	}
	if (sts != null) {
		weighted += sts * bobotSts;
		totalW += bobotSts;
	}
	if (totalW === 0) return null;
	return Math.round((weighted / totalW) * 100) / 100;
}

type MapelOption = { value: string; nama: string };

type MuridRow = {
	id: number;
	no: number;
	nama: string;
	agamaLabel?: string | null;
	/** mapelId efektif baris ini (varian agama/PKS sudah di-resolve) — dipakai isi massal. */
	mapelId: number | null;
	nilaiAkhirRts: number | null;
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

export async function load({ parent, url, depends, locals }) {
	depends('app:asesmen-sumatif');
	const { kelasAktif, kelasKonten, user } = await parent();
	// Kelas konten dari pemilih per halaman (?kelas=); fallback kelasAktif.
	const kelasKontenAktif = kelasKonten ?? kelasAktif;
	const meta: PageMeta = { title: 'Asesmen Sumatif' };

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
			daftarMurid: [] as MuridRow[],
			page: pageState
		};
	}

	let mapelRecords = await db.query.tableMataPelajaran.findMany({
		columns: { id: true, nama: true, namaLokal: true, kkm: true },
		where: eq(tableMataPelajaran.kelasId, kelasKontenAktif.id),
		orderBy: asc(tableMataPelajaran.nama)
	});

	// Restrict for 'user' accounts assigned to mata pelajaran.
	// First check join table auth_user_mata_pelajaran for multi-mapel support,
	// then fallback to legacy mataPelajaranId field if join table is empty.
	// IMPORTANT: Match by mapel name (since same subject can exist in different classes)
	const maybeUser = user as unknown as
		{ id?: number; type?: string; mataPelajaranId?: number; pegawaiId?: number | null } | undefined;
	// Guru merangkap wali kelas (type 'user'): bebas akses seluruh mapel di
	// kelas yang diwalikan — paritas dengan akun wali kelas lama.
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
			// Populate assignedMapelIds for assignedLocalMapelId detection below
			for (const id of userAkses.ids) {
				assignedMapelIds.add(id);
			}
		} catch {
			// Silently handle error
		}
	}

	const mapelByName = new Map(mapelRecords.map((record) => [normalizeText(record.nama), record]));

	// Determine if the logged-in user is assigned to mata pelajaran.
	// For multi-mapel: pick the first one as assignedLocalMapelId (used for display).
	// assignedIsAgamaVariant is set if any of the assigned mapel is agama variant.
	let assignedLocalMapelId: number | null = null;
	let assignedIsAgamaVariant = false;
	if (
		needsMapelFilter(
			{ ...maybeUser, ownKelasIds: guruOwnKelasIds },
			kelasKontenAktif?.id ?? null
		) &&
		maybeUser?.id
	) {
		// Check multi-mapel first
		if (assignedMapelIds.size > 0) {
			// Pick first assigned mapel from the filtered list
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
			// Fallback to legacy single mapel
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

	// If requestedValue is a numeric ID that matches an agama or PKS variant,
	// convert it to the special value ('agama' or 'pks')
	if (selectedMapelValue) {
		const requestedId = Number(selectedMapelValue);
		if (Number.isInteger(requestedId) && requestedId > 0) {
			const requestedRecord = mapelRecords.find((r) => r.id === requestedId);
			if (requestedRecord) {
				// Check if it's an agama variant
				if (isAgamaSubject(requestedRecord.nama)) {
					// Use special 'agama' value for all agama variants
					selectedMapelValue = AGAMA_MAPEL_VALUE;
				} else if (isPksSubject(requestedRecord.nama)) {
					// Use special 'pks' value for all PKS variants
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
		nilaiAkhir: null,
		naLingkup: null,
		sts: null,
		sas: null,
		nilaiHref: null,
		canNilai: true,
		tpScores: {}
	}));

	if (!selectedMapelValue) {
		return {
			meta,
			mapelList: mapelOptions,
			selectedMapelValue,
			selectedMapel,
			daftarMurid: baseList,
			page: pageState
		};
	}

	await ensureAsesmenSumatifSchema();

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
				orderBy: [asc(tableTujuanPembelajaran.lingkupMateri), asc(tableTujuanPembelajaran.id)]
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
		bobot: t.bobot ?? 0,
		teknikPenilaianId: t.teknikPenilaianId,
		teknikNama: t.teknikPenilaian?.nama ?? null,
		teknikSingkatan: t.teknikPenilaian?.singkatan ?? null
	}));

	const kunciNilai = selectedMapelRecord
		? await loadKunciNilai([selectedMapelRecord.id])
		: new Map();
	const isTerkunci = selectedMapelRecord ? kunciNilai.has(selectedMapelRecord.id) : false;

	const bobotLingkup = Number(locals.sekolah?.sumatifBobotLingkup ?? 60);
	const bobotSts = Number(locals.sekolah?.sumatifBobotSts ?? 20);
	const bobotSas = Number(locals.sekolah?.sumatifBobotSas ?? 20);
	const bobotRtsLingkup = Number(locals.sekolah?.sumatifBobotRtsLingkup ?? 70);
	const bobotRtsSts = Number(locals.sekolah?.sumatifBobotRtsSts ?? 30);

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
			// Guru merangkap wali kelas di kelasnya sendiri: paritas wali kelas lama.
			if (kelasKontenAktif?.id != null && guruOwnKelasIds?.includes(kelasKontenAktif.id))
				return true;

			if ((isAgamaSelected || isPksSelected) && allowedAgamaVariants.size > 0) {
				// Hanya murid dengan agama varian yang diajar guru (termasuk sub-nya).
				const label = labelVarianUntukMurid(selectedMapel?.nama ?? '', murid.agama);
				return !!label && allowedAgamaVariants.has(label);
			}

			// For non-agama mapel, check standard assignment
			if (!assignedIsAgamaVariant) return true;
			if (!assignedLocalMapelId) return false;
			return targetMapelId === assignedLocalMapelId;
		})();

		// Murid di luar varian/mapel guru: jangan bocorkan nilai milik guru lain.
		if (!canAccess) {
			return {
				id: murid.id,
				no: offset + index + 1,
				nama: murid.nama,
				agamaLabel,
				mapelId: targetMapelId,
				nilaiAkhirRts: null,
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

		return {
			id: murid.id,
			no: offset + index + 1,
			nama: murid.nama,
			agamaLabel,
			mapelId: targetMapelId,
			nilaiAkhirRts: formatScore(
				computeNilaiAkhirRts(sumatif?.naLingkup, sumatif?.sts, bobotRtsLingkup, bobotRtsSts)
			),
			nilaiAkhir: formatScore(
				computeNilaiAkhir(
					sumatif?.naLingkup,
					sumatif?.sts,
					sumatif?.sas,
					bobotLingkup,
					bobotSts,
					bobotSas
				)
			),
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
		daftarMurid,
		tujuanList,
		kkm: selectedMapelRecord?.kkm ?? 75,
		isTerkunci,
		sumatifWeights: {
			lingkup: bobotLingkup,
			sts: bobotSts,
			sas: bobotSas
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
	lingkup: 'Lingkup Materi',
	sts: 'STS',
	sas: 'SAS'
};

export const actions = {
	/**
	 * Simpan seluruh nilai matriks spreadsheet satu kelas (TP, STS, SAS).
	 */
	simpanMatriks: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const formData = await request.formData();
		const payloadRaw = formData.get('payload');
		if (!payloadRaw) return fail(400, { fail: 'Data nilai kosong.' });

		let rows: Array<{
			muridId: number;
			mapelId: number;
			tpScores: Record<string, number | null>;
			sts: number | null;
			sas: number | null;
		}>;
		try {
			rows = JSON.parse(String(payloadRaw));
		} catch {
			return fail(400, { fail: 'Format data matriks tidak valid.' });
		}

		if (!Array.isArray(rows) || !rows.length) {
			return fail(400, { fail: 'Pilih minimal satu murid untuk disimpan.' });
		}

		await ensureAsesmenSumatifSchema();

		// Check locks
		const uniqueMapelIds = [...new Set(rows.map((r) => r.mapelId).filter(Boolean))];
		for (const part of chunk(uniqueMapelIds, 90)) {
			const kunci = await loadKunciNilai(part);
			for (const [mapelId, info] of kunci) {
				return fail(403, {
					fail: `Nilai mata pelajaran sudah dikunci${info?.dikunciOleh ? ` oleh ${info.dikunciOleh}` : ''}. Hubungi operator untuk membuka kunci.`
				});
			}
		}

		const bobotLingkup = Number(locals.sekolah?.sumatifBobotLingkup ?? 60);
		const bobotSts = Number(locals.sekolah?.sumatifBobotSts ?? 20);
		const bobotSas = Number(locals.sekolah?.sumatifBobotSas ?? 20);
		const bobotRtsLingkup = Number(locals.sekolah?.sumatifBobotRtsLingkup ?? 70);
		const bobotRtsSts = Number(locals.sekolah?.sumatifBobotRtsSts ?? 30);
		const nowIso = new Date().toISOString();

		for (const row of rows) {
			const muridId = row.muridId;
			const mapelId = row.mapelId;
			if (!muridId || !mapelId) continue;

			const validTpValues: number[] = [];
			if (row.tpScores && typeof row.tpScores === 'object') {
				for (const [tpIdStr, scoreRaw] of Object.entries(row.tpScores)) {
					const tpId = Number(tpIdStr);
					if (!Number.isInteger(tpId) || tpId <= 0) continue;
					const score =
						scoreRaw != null && !Number.isNaN(Number(scoreRaw)) && String(scoreRaw).trim() !== ''
							? Math.min(100, Math.max(0, Math.round(Number(scoreRaw) * 100) / 100))
							: null;

					if (score != null) {
						validTpValues.push(score);
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
				validTpValues.length > 0
					? Math.round((validTpValues.reduce((a, b) => a + b, 0) / validTpValues.length) * 100) / 100
					: null;

			const sts =
				row.sts != null && !Number.isNaN(Number(row.sts)) && String(row.sts).trim() !== ''
					? Math.min(100, Math.max(0, Math.round(Number(row.sts) * 100) / 100))
					: null;
			const sas =
				row.sas != null && !Number.isNaN(Number(row.sas)) && String(row.sas).trim() !== ''
					? Math.min(100, Math.max(0, Math.round(Number(row.sas) * 100) / 100))
					: null;

			const nilaiAkhir = computeNilaiAkhir(naLingkup, sts, sas, bobotLingkup, bobotSts, bobotSas);
			const nilaiAkhirRts = computeNilaiAkhirRts(naLingkup, sts, bobotRtsLingkup, bobotRtsSts);

			await db
				.insert(tableAsesmenSumatif)
				.values({
					muridId,
					mataPelajaranId: mapelId,
					naLingkup,
					sts,
					sas,
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
	 * Isi satu komponen nilai untuk banyak murid sekaligus ("Isi Sekaligus").
	 * `items` berisi pasangan muridId+mapelId (mapel sudah di-resolve per murid
	 * oleh halaman, termasuk varian agama/PKS), jadi server tidak perlu menebak.
	 */
	simpanMassal: async ({ request, locals }) => {
		const sekolahId = locals.sekolah?.id ?? null;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

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

		const muridRows = await queryInChunks(muridIds, (ids) =>
			db
				.select({ id: tableMurid.id, kelasId: tableMurid.kelasId })
				.from(tableMurid)
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
		);
		const muridKelas = new Map(muridRows.map((row) => [row.id, row.kelasId]));

		const mapelRows = await queryInChunks(mapelIds, (ids) =>
			db
				.select({
					id: tableMataPelajaran.id,
					nama: tableMataPelajaran.nama,
					kelasId: tableMataPelajaran.kelasId
				})
				.from(tableMataPelajaran)
				.where(inArray(tableMataPelajaran.id, ids))
		);
		const mapelById = new Map(mapelRows.map((row) => [row.id, row]));

		const valid = items.filter((item) => {
			const kelasId = muridKelas.get(item.muridId);
			const mapel = mapelById.get(item.mapelId);
			return kelasId != null && mapel != null && mapel.kelasId === kelasId;
		});
		if (!valid.length) {
			return fail(400, { fail: 'Tidak ada pasangan murid dan mata pelajaran yang valid.' });
		}

		// Izin: guru mapel hanya mapel yang diampu; wali kelas boleh kelas
		// binaannya, selain itu tetap dicek per mapel (paritas formulir).
		const user = locals.user as {
			id?: number;
			type?: string;
			mataPelajaranId?: number | null;
			pegawaiId?: number | null;
		} | null;
		const uniqueMapelIds = [...new Set(valid.map((item) => item.mapelId))];
		if (user?.id && user.type !== 'admin' && user.type !== 'kepala_sekolah') {
			for (const mapelId of uniqueMapelIds) {
				const mapel = mapelById.get(mapelId);
				if (!mapel) continue;
				if (user.type === 'wali_kelas' && user.pegawaiId) {
					const ownKelas = await db.query.tableKelas.findFirst({
						columns: { id: true },
						where: and(eq(tableKelas.id, mapel.kelasId), eq(tableKelas.waliKelasId, user.pegawaiId))
					});
					if (ownKelas) continue;
				}
				const allowed = await bolehAksesMapel(
					{ id: user.id, mataPelajaranId: user.mataPelajaranId ?? null },
					{ id: mapel.id, nama: mapel.nama }
				);
				if (!allowed) {
					return fail(403, { fail: `Anda tidak memiliki akses ke mata pelajaran ${mapel.nama}.` });
				}
			}
		}

		await ensureAsesmenSumatifSchema();

		// Kunci nilai membatasi edit; periksa per potongan id.
		for (const part of chunk(uniqueMapelIds, 90)) {
			const kunci = await loadKunciNilai(part);
			for (const [mapelId, info] of kunci) {
				return fail(403, {
					fail: `Nilai ${mapelById.get(mapelId)?.nama ?? ''} sudah dikunci${
						info?.dikunciOleh ? ` oleh ${info.dikunciOleh}` : ''
					}. Hubungi operator sekolah untuk membuka kunci.`
				});
			}
		}

		// Ambil nilai lama untuk komponen lain (lingkup/STS/SAS tidak ikut diubah).
		const nilaiLama = new Map<
			string,
			{ naLingkup: number | null; sts: number | null; sas: number | null }
		>();
		for (const mapelId of uniqueMapelIds) {
			const ids = valid.filter((item) => item.mapelId === mapelId).map((item) => item.muridId);
			await queryInChunks(ids, async (part) => {
				const rows = await db.query.tableAsesmenSumatif.findMany({
					columns: { muridId: true, naLingkup: true, sts: true, sas: true },
					where: and(
						eq(tableAsesmenSumatif.mataPelajaranId, mapelId),
						inArray(tableAsesmenSumatif.muridId, part)
					)
				});
				for (const row of rows) {
					nilaiLama.set(`${row.muridId}|${mapelId}`, {
						naLingkup: row.naLingkup,
						sts: row.sts,
						sas: row.sas
					});
				}
				return rows;
			});
		}

		const konfigurasi = konfigurasiNilaiDariSekolah(locals.sekolah ?? null);
		const now = new Date().toISOString();
		const values = valid.map((item) => {
			const lama = nilaiLama.get(`${item.muridId}|${item.mapelId}`);
			const naLingkup = komponen === 'lingkup' ? nilai : (lama?.naLingkup ?? null);
			const sts = komponen === 'sts' ? nilai : (lama?.sts ?? null);
			const sas = komponen === 'sas' ? nilai : (lama?.sas ?? null);
			return {
				muridId: item.muridId,
				mataPelajaranId: item.mapelId,
				naLingkup,
				sts,
				sas,
				nilaiAkhir: hitungNilaiAkhirSumatif({ naLingkup, sts, sas }, konfigurasi.bobotAkhir),
				nilaiAkhirRts: hitungNilaiAkhirRts({ naLingkup, sts }, konfigurasi.bobotRts),
				updatedAt: now
			};
		});

		// Satu statement upsert per potongan kecil (D1 maks 100 parameter).
		for (const part of chunk(values, 10)) {
			await db
				.insert(tableAsesmenSumatif)
				.values(part)
				.onConflictDoUpdate({
					target: [tableAsesmenSumatif.muridId, tableAsesmenSumatif.mataPelajaranId],
					set: {
						naLingkup: sql`excluded.na_lingkup`,
						sts: sql`excluded.sts`,
						sas: sql`excluded.sas`,
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
