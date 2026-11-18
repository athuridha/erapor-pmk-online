import db from '$lib/server/db';
import {
	daftarKelasSekolah,
	daftarSemester,
	identityOf,
	jenjangKelas,
	type OpsiKelas,
	type SemesterColumn
} from '$lib/admin/rekap.server';
import { chunk, queryInChunks } from '$lib/server/db/chunk';
import {
	tableAsesmenSumatif,
	tableKehadiranMurid,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai
} from '$lib/server/db/schema';
import { isKeluargaAgama, isKeluargaPks, namaVarianUntukMurid } from '$lib/server/mapel-picker';
import {
	hitungNilaiAkhirSumatif,
	loadKonfigurasiNilai,
	type BobotSumatif
} from '$lib/server/nilai-sumatif';
import { agamaParentName, pksParentName } from '$lib/statics';
import { and, asc, eq, inArray } from 'drizzle-orm';

export type MapelLeggerRow = {
	id: number;
	kelasId: number;
	nama: string;
	namaLokal: string | null;
	kode: string | null;
	kkm: number;
	jenis: string;
	kategori: string;
	urutan: number | null;
};

export type MuridLeggerRow = {
	id: number;
	kelasId: number;
	semesterId: number;
	nama: string;
	nis: string;
	nisn: string;
	jenisKelamin: 'L' | 'P';
	agama: string;
	status: string;
};

export type SumatifLeggerRow = {
	muridId: number;
	mataPelajaranId: number;
	naLingkup: number | null;
	sts: number | null;
	sas: number | null;
	nilaiAkhir: number | null;
};

export type NilaiDetail = {
	nilaiAkhir: number | null;
	naLingkup: number | null;
	sts: number | null;
	sas: number | null;
};

export type KolomLegger = {
	key: string;
	mapelId: number | null;
	keluarga: 'agama' | 'pks' | null;
	nama: string;
	singkatan: string;
};

export type BarisLegger = {
	muridId: number;
	nama: string;
	nis: string;
	nisn: string;
	sel: (number | null)[];
	rataRata: number | null;
};

export type OpsiMuridLegger = {
	id: number;
	nama: string;
	nis: string;
	nisn: string;
	agama: string;
};

export type RiwayatSemesterMurid = {
	muridId: number;
	semesterId: number;
	semesterLabel: string;
	tahunAjaran: string;
	tipeSemester: 'ganjil' | 'genap';
	semesterKe: number | null;
	urut: number;
	kelasId: number;
	kelasNama: string;
	fase: string | null;
	tingkat: string;
	tingkatUrut: number;
	waliKelas: string | null;
	jumlahNilai: number;
	rataRata: number | null;
	terisi: number;
	totalMapel: number;
	sakit: number;
	izin: number;
	alfa: number;
};

export type SelMapelMurid = {
	diambil: boolean;
	nilaiAkhir: number | null;
	naLingkup: number | null;
	sts: number | null;
	sas: number | null;
	kkm: number | null;
};

export type BarisMapelMurid = {
	key: string;
	nama: string;
	kode: string | null;
	jenisLabel: string | null;
	sel: SelMapelMurid[];
	rataRata: number | null;
};

export type RingkasanTingkatMurid = {
	tingkat: 'X' | 'XI' | 'XII';
	label: string;
	adaData: boolean;
	kelasDaftar: string[];
	jumlahSemester: number;
	terisi: number;
	totalMapel: number;
	rataRata: number | null;
};

export type OpsiWaktuLegger = {
	value: string;
	label: string;
	sublabel: string | null;
	kind: 'semua' | 'tingkat' | 'semester';
};

export type LeggerMuridDetail = {
	murid: {
		id: number;
		nama: string;
		nis: string;
		nisn: string;
		jenisKelamin: 'L' | 'P';
		agama: string;
		status: string;
		kelasId: number;
		kelasNama: string;
		fase: string | null;
		waliKelas: string | null;
	};
	waktuPilihan: OpsiWaktuLegger[];
	waktuTerpilih: string;
	semuaRiwayat: RiwayatSemesterMurid[];
	riwayatTampil: RiwayatSemesterMurid[];
	ringkasanTingkat: RingkasanTingkatMurid[];
	barisMapel: BarisMapelMurid[];
	rataKumulatif: number | null;
	totalNilaiKumulatif: number;
	totalTerisiKumulatif: number;
	totalMapelKumulatif: number;
	totalKehadiran: { sakit: number; izin: number; alfa: number };
};

export type OpsiKelasLegger = OpsiKelas & {
	isSemesterAktif: boolean;
	jumlahMurid: number;
};

const SUMATIF_CHUNK = 45;
const normText = (v: string | null | undefined) =>
	(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

const JENIS_LABEL: Record<string, string> = {
	wajib: 'Umum / Wajib',
	kejuruan: 'Kejuruan',
	pilihan: 'Pilihan',
	mulok: 'Muatan Lokal',
	pemberdayaan: 'Pemberdayaan'
};

function round2(value: number) {
	return Number.parseFloat(value.toFixed(2));
}

function parseTingkatUrut(tingkat: string): number {
	if (tingkat === 'X') return 10;
	if (tingkat === 'XI') return 11;
	if (tingkat === 'XII') return 12;
	return 99;
}

/** Label semester 1-6 based on SMK level (X -> 1/2, XI -> 3/4, XII -> 5/6). */
function computeSemesterKe(tingkat: string, tipe: 'ganjil' | 'genap'): number | null {
	const offset = tipe === 'ganjil' ? 1 : 2;
	if (tingkat === 'X') return offset;
	if (tingkat === 'XI') return 2 + offset;
	if (tingkat === 'XII') return 4 + offset;
	return null;
}

function shortSubjectCode(row: { nama: string; kode: string | null }) {
	const kode = (row.kode ?? '').trim();
	if (kode) return kode;
	const initials = row.nama
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 3)
		.map((word) => word.charAt(0).toUpperCase())
		.join('');
	return initials || row.nama.slice(0, 6);
}

function compareMapel(
	a: { urutan: number | null; nama: string },
	b: { urutan: number | null; nama: string }
) {
	return (
		(a.urutan ?? Number.POSITIVE_INFINITY) - (b.urutan ?? Number.POSITIVE_INFINITY) ||
		collator.compare(a.nama, b.nama)
	);
}

/** Column list for a class grid: agama/PKS variants merge into a single column each. */
export function kolomMapelKelas(rows: MapelLeggerRow[]): KolomLegger[] {
	const terurut = rows.filter((r) => r.kategori !== 'kokurikuler').sort(compareMapel);
	const kolom: KolomLegger[] = [];
	for (const row of terurut) {
		if (isKeluargaAgama(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'agama')) {
				kolom.push({
					key: 'keluarga-agama',
					mapelId: null,
					keluarga: 'agama',
					nama: agamaParentName,
					singkatan: 'AGM'
				});
			}
			continue;
		}
		if (isKeluargaPks(row.nama)) {
			if (!kolom.some((k) => k.keluarga === 'pks')) {
				kolom.push({
					key: 'keluarga-pks',
					mapelId: null,
					keluarga: 'pks',
					nama: pksParentName,
					singkatan: 'PKS'
				});
			}
			continue;
		}
		kolom.push({
			key: `mapel-${row.id}`,
			mapelId: row.id,
			keluarga: null,
			nama: row.namaLokal?.trim() || row.nama,
			singkatan: shortSubjectCode(row)
		});
	}
	return kolom;
}

/** Variant mapel id for one student's religion/PKS column. */
export function idVarianMurid(
	familyRows: MapelLeggerRow[],
	baseName: string,
	agama: string | null | undefined
): number | null {
	if (!familyRows.length) return null;
	const target = normText(namaVarianUntukMurid(baseName, agama));
	return (
		familyRows.find((row) => normText(row.nama) === target)?.id ??
		familyRows.find((row) => normText(row.nama) === normText(baseName))?.id ??
		familyRows[0]?.id ??
		null
	);
}

/** Chunked sumatif query sized to fit D1 parameter limits. */
export async function muatSumatifKelas(
	muridIds: number[],
	mapelIds: number[]
): Promise<SumatifLeggerRow[]> {
	const rows: SumatifLeggerRow[] = [];
	for (const muridPart of chunk(muridIds, SUMATIF_CHUNK)) {
		for (const mapelPart of chunk(mapelIds, SUMATIF_CHUNK)) {
			rows.push(
				...(await db.query.tableAsesmenSumatif.findMany({
					columns: {
						muridId: true,
						mataPelajaranId: true,
						naLingkup: true,
						sts: true,
						sas: true,
						nilaiAkhir: true
					},
					where: and(
						inArray(tableAsesmenSumatif.muridId, muridPart),
						inArray(tableAsesmenSumatif.mataPelajaranId, mapelPart)
					)
				}))
			);
		}
	}
	return rows;
}

export function buildNilaiMap(
	rows: SumatifLeggerRow[],
	bobot: BobotSumatif
): Map<string, NilaiDetail> {
	const map = new Map<string, NilaiDetail>();
	for (const row of rows) {
		const nilaiAkhir =
			hitungNilaiAkhirSumatif({ naLingkup: row.naLingkup, sts: row.sts, sas: row.sas }, bobot) ??
			row.nilaiAkhir;
		map.set(`${row.muridId}|${row.mataPelajaranId}`, {
			nilaiAkhir: nilaiAkhir != null ? round2(nilaiAkhir) : null,
			naLingkup: row.naLingkup != null ? round2(row.naLingkup) : null,
			sts: row.sts != null ? round2(row.sts) : null,
			sas: row.sas != null ? round2(row.sas) : null
		});
	}
	return map;
}

export function buildBarisLeggerKelas(
	muridKelas: MuridLeggerRow[],
	kolom: KolomLegger[],
	mapelKelas: MapelLeggerRow[],
	nilaiMap: Map<string, NilaiDetail>
): BarisLegger[] {
	const intraRows = mapelKelas.filter((r) => r.kategori !== 'kokurikuler');
	const agamaRows = intraRows.filter((row) => isKeluargaAgama(row.nama));
	const pksRows = intraRows.filter((row) => isKeluargaPks(row.nama));
	return muridKelas.map((murid) => {
		const agamaId = idVarianMurid(agamaRows, agamaParentName, murid.agama);
		const pksId = idVarianMurid(pksRows, pksParentName, murid.agama);
		const sel = kolom.map((col) => {
			const mapelId =
				col.keluarga === 'agama' ? agamaId : col.keluarga === 'pks' ? pksId : col.mapelId;
			if (mapelId == null) return null;
			return nilaiMap.get(`${murid.id}|${mapelId}`)?.nilaiAkhir ?? null;
		});
		const valid = sel.filter((v): v is number => v != null);
		const rataRata =
			valid.length > 0 ? round2(valid.reduce((sum, n) => sum + n, 0) / valid.length) : null;
		return {
			muridId: murid.id,
			nama: murid.nama,
			nis: murid.nis,
			nisn: murid.nisn,
			sel,
			rataRata
		};
	});
}

export function hitungKelengkapan(baris: BarisLegger[], kolom: KolomLegger[]) {
	const terisi = baris.reduce((acc, row) => acc + row.sel.filter((v) => v != null).length, 0);
	const total = baris.length * kolom.length;
	const persentase = total > 0 ? Math.round((terisi / total) * 100) : null;
	return { terisi, total, persentase };
}

/**
 * Resolve all classes a user may view in Legger, ordered with active semester first
 * and annotated with student counts.
 */
export async function listOpsiKelasLegger(
	sekolahId: number,
	activeSemesterId: number | null,
	allowedKelasIds: Set<number> | null
): Promise<OpsiKelasLegger[]> {
	const [semuaKelas, muridCounts] = await Promise.all([
		daftarKelasSekolah(sekolahId),
		db.query.tableMurid.findMany({
			columns: { kelasId: true },
			where: eq(tableMurid.sekolahId, sekolahId)
		})
	]);
	const countPerKelas = new Map<number, number>();
	for (const m of muridCounts) {
		countPerKelas.set(m.kelasId, (countPerKelas.get(m.kelasId) ?? 0) + 1);
	}

	return semuaKelas
		.filter((k) => (allowedKelasIds ? allowedKelasIds.has(k.id) : true))
		.map((k) => ({
			...k,
			isSemesterAktif: activeSemesterId != null && k.semesterId === activeSemesterId,
			jumlahMurid: countPerKelas.get(k.id) ?? 0
		}))
		.sort((a, b) => {
			if (a.isSemesterAktif !== b.isSemesterAktif) return a.isSemesterAktif ? -1 : 1;
			return collator.compare(b.semesterLabel, a.semesterLabel) || collator.compare(a.nama, b.nama);
		});
}

function sameStudentIdentity(target: MuridLeggerRow, candidate: MuridLeggerRow): boolean {
	if (candidate.id === target.id) return true;
	const targetKey = identityOf(target.nis, target.nisn);
	const candKey = identityOf(candidate.nis, candidate.nisn);
	if (targetKey && candKey && targetKey === candKey) return true;
	const tNis = normText(target.nis);
	const cNis = normText(candidate.nis);
	const tNisn = normText(target.nisn);
	const cNisn = normText(candidate.nisn);
	// If one record only has NISN (empty NIS), fall back to matching NISN.
	if (tNisn && cNisn && tNisn === cNisn && (!tNis || !cNis || tNis === cNis)) return true;
	return false;
}

/** Build the chronological individual Legger (Kelas X -> XI -> XII) for a single student. */
export async function buildLeggerMurid(params: {
	sekolahId: number;
	kelasId: number;
	muridId: number | null;
	waktuParam: string | null;
	bobot?: BobotSumatif;
}): Promise<{
	daftarMuridKelas: OpsiMuridLegger[];
	detail: LeggerMuridDetail | null;
	bobot: BobotSumatif;
}> {
	const { sekolahId, kelasId, muridId, waktuParam } = params;
	const bobot = params.bobot ?? (await loadKonfigurasiNilai(sekolahId)).bobotAkhir;

	const muridKelasRows = await db.query.tableMurid.findMany({
		columns: {
			id: true,
			kelasId: true,
			semesterId: true,
			nama: true,
			nis: true,
			nisn: true,
			jenisKelamin: true,
			agama: true,
			status: true
		},
		where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.kelasId, kelasId)),
		orderBy: asc(tableMurid.nama)
	});

	const daftarMuridKelas: OpsiMuridLegger[] = muridKelasRows.map((m) => ({
		id: m.id,
		nama: m.nama,
		nis: m.nis,
		nisn: m.nisn,
		agama: m.agama
	}));

	if (!muridKelasRows.length) {
		return { daftarMuridKelas, detail: null, bobot };
	}

	const selectedMurid =
		(muridId != null ? muridKelasRows.find((m) => m.id === muridId) : undefined) ??
		muridKelasRows[0];

	// Load all students in school only by minimal columns to trace X -> XI -> XII history safely.
	const allSchoolStudents = await db.query.tableMurid.findMany({
		columns: {
			id: true,
			kelasId: true,
			semesterId: true,
			nama: true,
			nis: true,
			nisn: true,
			jenisKelamin: true,
			agama: true,
			status: true
		},
		where: eq(tableMurid.sekolahId, sekolahId)
	});

	const historyRows = allSchoolStudents.filter((m) => sameStudentIdentity(selectedMurid, m));
	const historyKelasIds = [...new Set(historyRows.map((r) => r.kelasId))];
	const historyMuridIds = historyRows.map((r) => r.id);

	const [semuaSemester, kelasRows, mapelRows, kehadiranRows] = await Promise.all([
		daftarSemester(sekolahId),
		historyKelasIds.length
			? db.query.tableKelas.findMany({
					columns: { id: true, nama: true, fase: true, semesterId: true, waliKelasId: true },
					where: inArray(tableKelas.id, historyKelasIds)
				})
			: Promise.resolve([]),
		historyKelasIds.length
			? db.query.tableMataPelajaran.findMany({
					columns: {
						id: true,
						kelasId: true,
						nama: true,
						namaLokal: true,
						kode: true,
						kkm: true,
						jenis: true,
						kategori: true,
						urutan: true
					},
					where: inArray(tableMataPelajaran.kelasId, historyKelasIds)
				})
			: Promise.resolve([]),
		historyMuridIds.length
			? queryInChunks(historyMuridIds, (ids) =>
					db.query.tableKehadiranMurid.findMany({
						columns: { muridId: true, sakit: true, izin: true, alfa: true },
						where: inArray(tableKehadiranMurid.muridId, ids)
					})
				)
			: Promise.resolve([])
	]);

	const waliIds = [
		...new Set(kelasRows.map((k) => k.waliKelasId).filter((v): v is number => v != null))
	];
	const waliRows = waliIds.length
		? await db.query.tablePegawai.findMany({
				columns: { id: true, nama: true },
				where: inArray(tablePegawai.id, waliIds)
			})
		: [];
	const waliById = new Map(waliRows.map((w) => [w.id, w.nama]));
	const kelasById = new Map(kelasRows.map((k) => [k.id, k]));
	const semesterById = new Map<number, SemesterColumn>(
		semuaSemester.map((sem) => [sem.semesterId, sem])
	);
	const kehadiranByMurid = new Map(kehadiranRows.map((k) => [k.muridId, k]));

	const intraMapelPerKelas = new Map<number, MapelLeggerRow[]>();
	const allIntraMapelIds: number[] = [];
	for (const m of mapelRows) {
		if (m.kategori === 'kokurikuler') continue;
		const list = intraMapelPerKelas.get(m.kelasId) ?? [];
		list.push(m);
		intraMapelPerKelas.set(m.kelasId, list);
		allIntraMapelIds.push(m.id);
	}

	const sumatifRows =
		historyMuridIds.length && allIntraMapelIds.length
			? await muatSumatifKelas(historyMuridIds, allIntraMapelIds)
			: [];
	const nilaiMap = buildNilaiMap(sumatifRows, bobot);

	// Order student records chronologically from Kelas X to Kelas XII.
	const orderedHistory = historyRows
		.map((muridRow) => {
			const kls = kelasById.get(muridRow.kelasId);
			const sem = semesterById.get(kls?.semesterId ?? muridRow.semesterId);
			const kelasNama = kls?.nama ?? '-';
			const tingkat = jenjangKelas(kelasNama);
			const tingkatUrut = parseTingkatUrut(tingkat);
			const semTipe = sem?.tipe ?? 'ganjil';
			return {
				muridRow,
				kls,
				sem,
				kelasNama,
				tingkat,
				tingkatUrut,
				semesterKe: computeSemesterKe(tingkat, semTipe),
				semUrut: sem?.urut ?? 0
			};
		})
		.sort(
			(a, b) =>
				a.tingkatUrut - b.tingkatUrut ||
				a.semUrut - b.semUrut ||
				collator.compare(a.kelasNama, b.kelasNama)
		);

	// Build canonical subject catalog across all attended semesters.
	type SubjectMeta = {
		key: string;
		nama: string;
		kode: string | null;
		jenisLabel: string | null;
		minUrutan: number;
		keluarga: 'agama' | 'pks' | null;
	};
	const subjectCatalog = new Map<string, SubjectMeta>();
	const resolvedSelPerHistory = new Map<number, Map<string, SelMapelMurid>>();

	const allRiwayat: RiwayatSemesterMurid[] = [];

	for (const entry of orderedHistory) {
		const mapelKelas = (intraMapelPerKelas.get(entry.muridRow.kelasId) ?? []).sort(compareMapel);
		const agamaRows = mapelKelas.filter((m) => isKeluargaAgama(m.nama));
		const pksRows = mapelKelas.filter((m) => isKeluargaPks(m.nama));
		const selMap = new Map<string, SelMapelMurid>();

		const resolveAndStore = (
			key: string,
			displayNama: string,
			kode: string | null,
			jenis: string,
			urutan: number | null,
			mapelId: number | null,
			kkm: number,
			keluarga: 'agama' | 'pks' | null
		) => {
			if (!subjectCatalog.has(key)) {
				subjectCatalog.set(key, {
					key,
					nama: displayNama,
					kode,
					jenisLabel: JENIS_LABEL[jenis] ?? null,
					minUrutan: urutan ?? Number.POSITIVE_INFINITY,
					keluarga
				});
			} else {
				const existing = subjectCatalog.get(key)!;
				if (urutan != null && urutan < existing.minUrutan) existing.minUrutan = urutan;
				if (!existing.kode && kode) existing.kode = kode;
				if (!existing.jenisLabel && JENIS_LABEL[jenis]) existing.jenisLabel = JENIS_LABEL[jenis];
			}
			const detail = mapelId != null ? nilaiMap.get(`${entry.muridRow.id}|${mapelId}`) : undefined;
			if (!selMap.has(key)) {
				selMap.set(key, {
					diambil: true,
					nilaiAkhir: detail?.nilaiAkhir ?? null,
					naLingkup: detail?.naLingkup ?? null,
					sts: detail?.sts ?? null,
					sas: detail?.sas ?? null,
					kkm
				});
			}
		};

		for (const row of mapelKelas) {
			if (isKeluargaAgama(row.nama)) {
				const chosenId = idVarianMurid(agamaRows, agamaParentName, entry.muridRow.agama);
				const chosenRow = agamaRows.find((r) => r.id === chosenId) ?? row;
				resolveAndStore(
					'keluarga:agama',
					agamaParentName,
					chosenRow.kode || 'AGM',
					chosenRow.jenis,
					chosenRow.urutan,
					chosenId,
					chosenRow.kkm,
					'agama'
				);
				continue;
			}
			if (isKeluargaPks(row.nama)) {
				const chosenId = idVarianMurid(pksRows, pksParentName, entry.muridRow.agama);
				const chosenRow = pksRows.find((r) => r.id === chosenId) ?? row;
				resolveAndStore(
					'keluarga:pks',
					pksParentName,
					chosenRow.kode || 'PKS',
					chosenRow.jenis,
					chosenRow.urutan,
					chosenId,
					chosenRow.kkm,
					'pks'
				);
				continue;
			}
			const displayNama = row.namaLokal?.trim() || row.nama;
			const key = `mapel:${normText(displayNama)}`;
			resolveAndStore(key, displayNama, row.kode, row.jenis, row.urutan, row.id, row.kkm, null);
		}

		resolvedSelPerHistory.set(entry.muridRow.id, selMap);

		const nilaiList = [...selMap.values()]
			.map((s) => s.nilaiAkhir)
			.filter((n): n is number => n != null);
		const jumlahNilai = round2(nilaiList.reduce((acc, n) => acc + n, 0));
		const rataRata = nilaiList.length > 0 ? round2(jumlahNilai / nilaiList.length) : null;
		const keh = kehadiranByMurid.get(entry.muridRow.id);

		allRiwayat.push({
			muridId: entry.muridRow.id,
			semesterId: entry.sem?.semesterId ?? entry.muridRow.semesterId,
			semesterLabel: entry.sem?.label ?? '-',
			tahunAjaran: entry.sem?.tahunAjaran ?? '-',
			tipeSemester: entry.sem?.tipe ?? 'ganjil',
			semesterKe: entry.semesterKe,
			urut: entry.semUrut,
			kelasId: entry.muridRow.kelasId,
			kelasNama: entry.kelasNama,
			fase: entry.kls?.fase ?? null,
			tingkat: entry.tingkat,
			tingkatUrut: entry.tingkatUrut,
			waliKelas: entry.kls?.waliKelasId ? (waliById.get(entry.kls.waliKelasId) ?? null) : null,
			jumlahNilai,
			rataRata,
			terisi: nilaiList.length,
			totalMapel: selMap.size,
			sakit: keh?.sakit ?? 0,
			izin: keh?.izin ?? 0,
			alfa: keh?.alfa ?? 0
		});
	}

	// Build dropdown options for "Waktu / Kelas Berapa"
	const waktuPilihan: OpsiWaktuLegger[] = [
		{
			value: 'semua',
			label: 'Semua Kelas (X - XI - XII, awal s.d. akhir)',
			sublabel: `${allRiwayat.length} periode semester`,
			kind: 'semua'
		}
	];
	for (const tingkat of ['X', 'XI', 'XII'] as const) {
		const countTingkat = allRiwayat.filter((r) => r.tingkat === tingkat).length;
		if (countTingkat > 1) {
			waktuPilihan.push({
				value: `tingkat:${tingkat}`,
				label: `Kelas ${tingkat} (Semua semester)`,
				sublabel: `${countTingkat} semester`,
				kind: 'tingkat'
			});
		}
	}
	for (const r of allRiwayat) {
		const tingkatPrefix =
			r.tingkat === 'X' || r.tingkat === 'XI' || r.tingkat === 'XII' ? `Kelas ${r.tingkat} - ` : '';
		waktuPilihan.push({
			value: `riwayat:${r.muridId}`,
			label: `${tingkatPrefix}${r.kelasNama} (${r.semesterLabel})`,
			sublabel: r.semesterKe ? `Semester ${r.semesterKe}` : null,
			kind: 'semester'
		});
	}

	const validWaktu = waktuPilihan.some((w) => w.value === waktuParam);
	const waktuTerpilih = validWaktu && waktuParam ? waktuParam : 'semua';

	let riwayatTampil = allRiwayat;
	if (waktuTerpilih.startsWith('tingkat:')) {
		const targetTingkat = waktuTerpilih.slice('tingkat:'.length);
		riwayatTampil = allRiwayat.filter((r) => r.tingkat === targetTingkat);
	} else if (waktuTerpilih.startsWith('riwayat:')) {
		const targetMuridId = Number(waktuTerpilih.slice('riwayat:'.length));
		const found = allRiwayat.filter((r) => r.muridId === targetMuridId);
		if (found.length) riwayatTampil = found;
	}

	// Sort subjects consistently across semesters, keeping only subjects taken in `riwayatTampil`.
	const orderedSubjects = [...subjectCatalog.values()]
		.filter((subj) =>
			riwayatTampil.some((r) => resolvedSelPerHistory.get(r.muridId)?.has(subj.key))
		)
		.sort((a, b) => a.minUrutan - b.minUrutan || collator.compare(a.nama, b.nama));

	const emptySel: SelMapelMurid = {
		diambil: false,
		nilaiAkhir: null,
		naLingkup: null,
		sts: null,
		sas: null,
		kkm: null
	};

	const barisMapel: BarisMapelMurid[] = orderedSubjects.map((subj) => {
		const sel = riwayatTampil.map(
			(r) => resolvedSelPerHistory.get(r.muridId)?.get(subj.key) ?? emptySel
		);
		const valid = sel.map((s) => s.nilaiAkhir).filter((v): v is number => v != null);
		const rataRata =
			valid.length > 0 ? round2(valid.reduce((sum, n) => sum + n, 0) / valid.length) : null;
		return {
			key: subj.key,
			nama: subj.nama,
			kode: subj.kode,
			jenisLabel: subj.jenisLabel,
			sel,
			rataRata
		};
	});

	// Ringkasan per tingkat (X, XI, XII) always uses all historical records so user sees full progression.
	const ringkasanTingkat: RingkasanTingkatMurid[] = (['X', 'XI', 'XII'] as const).map((tingkat) => {
		const items = allRiwayat.filter((r) => r.tingkat === tingkat);
		const allVals = items.flatMap((r) =>
			[...(resolvedSelPerHistory.get(r.muridId)?.values() ?? [])]
				.map((s) => s.nilaiAkhir)
				.filter((v): v is number => v != null)
		);
		const rataRata =
			allVals.length > 0 ? round2(allVals.reduce((sum, n) => sum + n, 0) / allVals.length) : null;
		return {
			tingkat,
			label: `Kelas ${tingkat}`,
			adaData: items.length > 0,
			kelasDaftar: [...new Set(items.map((r) => r.kelasNama))],
			jumlahSemester: items.length,
			terisi: items.reduce((sum, r) => sum + r.terisi, 0),
			totalMapel: items.reduce((sum, r) => sum + r.totalMapel, 0),
			rataRata
		};
	});

	// Cumulative aggregates across displayed periods (`riwayatTampil`)
	const tampilVals = riwayatTampil.flatMap((r) =>
		[...(resolvedSelPerHistory.get(r.muridId)?.values() ?? [])]
			.map((s) => s.nilaiAkhir)
			.filter((v): v is number => v != null)
	);
	const totalNilaiKumulatif = round2(tampilVals.reduce((sum, n) => sum + n, 0));
	const rataKumulatif =
		tampilVals.length > 0 ? round2(totalNilaiKumulatif / tampilVals.length) : null;
	const totalTerisiKumulatif = riwayatTampil.reduce((sum, r) => sum + r.terisi, 0);
	const totalMapelKumulatif = riwayatTampil.reduce((sum, r) => sum + r.totalMapel, 0);
	const totalKehadiran = {
		sakit: riwayatTampil.reduce((sum, r) => sum + r.sakit, 0),
		izin: riwayatTampil.reduce((sum, r) => sum + r.izin, 0),
		alfa: riwayatTampil.reduce((sum, r) => sum + r.alfa, 0)
	};

	const selectedKelasRow = kelasById.get(kelasId);
	const detail: LeggerMuridDetail = {
		murid: {
			id: selectedMurid.id,
			nama: selectedMurid.nama,
			nis: selectedMurid.nis,
			nisn: selectedMurid.nisn,
			jenisKelamin: selectedMurid.jenisKelamin,
			agama: selectedMurid.agama,
			status: selectedMurid.status,
			kelasId,
			kelasNama: selectedKelasRow?.nama ?? '-',
			fase: selectedKelasRow?.fase ?? null,
			waliKelas: selectedKelasRow?.waliKelasId
				? (waliById.get(selectedKelasRow.waliKelasId) ?? null)
				: null
		},
		waktuPilihan,
		waktuTerpilih,
		semuaRiwayat: allRiwayat,
		riwayatTampil,
		ringkasanTingkat,
		barisMapel,
		rataKumulatif,
		totalNilaiKumulatif,
		totalTerisiKumulatif,
		totalMapelKumulatif,
		totalKehadiran
	};

	return { daftarMuridKelas, detail, bobot };
}

/** Build class-level Legger grid for one class (used by tab "Satu Kelas" and Excel class export). */
export async function buildLeggerKelas(params: {
	sekolahId: number;
	kelasId: number;
	bobot?: BobotSumatif;
}) {
	const { sekolahId, kelasId } = params;
	const bobot = params.bobot ?? (await loadKonfigurasiNilai(sekolahId)).bobotAkhir;

	const [muridRows, mapelRows] = await Promise.all([
		db.query.tableMurid.findMany({
			columns: {
				id: true,
				kelasId: true,
				semesterId: true,
				nama: true,
				nis: true,
				nisn: true,
				jenisKelamin: true,
				agama: true,
				status: true
			},
			where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.kelasId, kelasId)),
			orderBy: asc(tableMurid.nama)
		}),
		db.query.tableMataPelajaran.findMany({
			columns: {
				id: true,
				kelasId: true,
				nama: true,
				namaLokal: true,
				kode: true,
				kkm: true,
				jenis: true,
				kategori: true,
				urutan: true
			},
			where: eq(tableMataPelajaran.kelasId, kelasId)
		})
	]);

	const muridIds = muridRows.map((m) => m.id);
	const mapelIds = mapelRows.filter((r) => r.kategori !== 'kokurikuler').map((m) => m.id);
	const sumatifRows =
		muridIds.length && mapelIds.length ? await muatSumatifKelas(muridIds, mapelIds) : [];
	const nilaiMap = buildNilaiMap(sumatifRows, bobot);
	const kolom = kolomMapelKelas(mapelRows);
	const baris = buildBarisLeggerKelas(muridRows, kolom, mapelRows, nilaiMap);
	const rekap = hitungKelengkapan(baris, kolom);

	return { kolom, baris, rekap, muridRows };
}
