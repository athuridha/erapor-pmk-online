import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tableSemester,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { relevanMapelUntukMurid } from '$lib/server/mapel-picker';
import {
	hitungNilaiAkhirSumatif,
	loadKonfigurasiNilai,
	type KonfigurasiNilai
} from '$lib/server/nilai-sumatif';
import { determinePredikat } from '$lib/rapor-modes';

/**
 * Rekap nilai keseluruhan: nilai tiap murid dari semester pertama ia masuk
 * sekolah sampai semester terakhir, untuk semua murid sekolah.
 *
 * Semuanya berasal dari database:
 * - Semester & kelas dari `tahun_ajaran`, `semester`, `kelas`.
 * - Nilai akhir dihitung ulang dari komponen lingkup/STS/SAS memakai bobot
 *   sekolah (bila komponen ada), jika tidak dipakai nilai akhir tersimpan.
 * - Ambang kriteria (Cukup/Baik) mengikuti `sekolah.rapor_kriteria_*` atau
 *   penimpaan per kelas di `kelas.rapor_kriteria_*`.
 * - Filter mata pelajaran & guru memakai mapel + pengampu yang tercatat di
 *   database (bukan daftar hard-coded).
 *
 * Catatan data: baris `murid` dibuat per semester (unik pada sekolah +
 * semester + NIS), jadi riwayat seorang murid dicari dengan mencocokkan
 * identitas (NIS, atau NISN bila NIS kosong) antar semester.
 */

export interface SemesterColumn {
	semesterId: number;
	tahunAjaran: string;
	tipe: 'ganjil' | 'genap';
	label: string;
	urut: number;
}

export interface SelRekap {
	semesterId: number;
	kelasNama: string | null;
	nilai: number | null;
	dinilai: number;
	total: number;
	kriteria: string | null;
	rataKkm: number | null;
}

export interface BarisRekap {
	key: string;
	muridId: number;
	nis: string;
	nisn: string;
	nama: string;
	kelasSekarang: string | null;
	perSemester: SelRekap[];
	rataKumulatif: number | null;
	kriteriaKumulatif: string | null;
	totalDinilai: number;
	peringkat: number;
}

export interface RingkasanSemester {
	semesterId: number;
	nilai: number | null;
	dinilai: number;
	kriteria: string | null;
}

export interface OpsiKelas {
	id: number;
	nama: string;
	semesterLabel: string;
	fase: string | null;
	semesterId: number;
	semesterNama: string;
	tahunAjaranNama: string;
}

export interface OpsiMapel {
	nama: string;
	guru: Array<{ id: number; nama: string }>;
}

export interface OpsiGuru {
	id: number;
	nama: string;
	mapel: string[];
}

export interface RekapMapel {
	nama: string;
	jumlahNilai: number;
	rataRata: number | null;
	kelas: number;
	guru: string[];
}

export interface RekapGuru {
	id: number;
	nama: string;
	mapel: string[];
	jumlahNilai: number;
	jumlahMurid: number;
	rataRata: number | null;
}

export interface RekapKeseluruhan {
	kelas: { id: number; nama: string; fase: string | null };
	semester: SemesterColumn[];
	baris: BarisRekap[];
	ringkasan: RingkasanSemester[];
	totalMurid: number;
	totalDinilai: number;
	daftarMapel: OpsiMapel[];
	daftarGuru: OpsiGuru[];
	rekapMapel: RekapMapel[];
	rekapGuru: RekapGuru[];
	konfigurasi: {
		bobotLingkup: number;
		bobotSts: number;
		bobotSas: number;
		kriteriaCukup: number;
		kriteriaBaik: number;
	};
}

export interface OpsiRekap {
	/** Batasi ke satu kelas. Null = semua murid sekolah. */
	kelasId?: number | null;
	/** Filter satu mata pelajaran (nama mapel kanonik). */
	filterMapel?: string | null;
	/** Filter mata pelajaran yang diampu guru tertentu. */
	pengampuId?: number | null;
}

type Akumulator = { sum: number; count: number; sumKkm: number };

function round2(value: number) {
	return Number.parseFloat(value.toFixed(2));
}

/** Tingkat/jenjang dari nama kelas, mis. "XII TSM" → "XII", "X RPL 1" → "X". */
function jenjangKelas(nama: string | null | undefined) {
	return (nama ?? '').trim().split(/\s+/)[0]?.toUpperCase() ?? '';
}

/** Identitas lintas semester: NIS lebih dulu, NISN sebagai cadangan. */
function identityOf(nis: string | null | undefined, nisn: string | null | undefined) {
	const nisTrim = (nis ?? '').trim();
	if (nisTrim) return `nis:${nisTrim.toLowerCase()}`;
	const nisnTrim = (nisn ?? '').trim();
	if (nisnTrim) return `nisn:${nisnTrim.toLowerCase()}`;
	return null;
}

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

function kosong(konfigurasi?: KonfigurasiNilai): RekapKeseluruhan {
	return {
		kelas: { id: 0, nama: 'Semua Kelas', fase: null },
		semester: [],
		baris: [],
		ringkasan: [],
		totalMurid: 0,
		totalDinilai: 0,
		daftarMapel: [],
		daftarGuru: [],
		rekapMapel: [],
		rekapGuru: [],
		konfigurasi: {
			bobotLingkup: konfigurasi?.bobotAkhir.lingkup ?? 60,
			bobotSts: konfigurasi?.bobotAkhir.sts ?? 20,
			bobotSas: konfigurasi?.bobotAkhir.sas ?? 20,
			kriteriaCukup: konfigurasi?.kriteriaCukup ?? 85,
			kriteriaBaik: konfigurasi?.kriteriaBaik ?? 95
		}
	};
}

async function daftarSemester(sekolahId: number) {
	const tahunAjaran = await db.query.tableTahunAjaran.findMany({
		columns: { id: true, nama: true, tanggalMulai: true },
		where: eq(tableTahunAjaran.sekolahId, sekolahId)
	});
	const tahunAjaranIds = tahunAjaran.map((row) => row.id);
	const semesterRows = tahunAjaranIds.length
		? await db.query.tableSemester.findMany({
				columns: { id: true, tahunAjaranId: true, tipe: true, nama: true },
				where: inArray(tableSemester.tahunAjaranId, tahunAjaranIds)
			})
		: [];

	const semuaPunyaTanggal = tahunAjaran.every((row) => (row.tanggalMulai ?? '').trim() !== '');
	const urutanTahunAjaran = new Map<number, number>();
	[...tahunAjaran]
		.sort((a, b) => {
			if (semuaPunyaTanggal) {
				const dateA = (a.tanggalMulai ?? '').trim();
				const dateB = (b.tanggalMulai ?? '').trim();
				if (dateA !== dateB) return dateA < dateB ? -1 : 1;
			}
			return collator.compare(a.nama, b.nama);
		})
		.forEach((row, index) => urutanTahunAjaran.set(row.id, index));

	const namaTahunAjaran = new Map(tahunAjaran.map((row) => [row.id, row.nama]));
	const semesterInfo = new Map<number, SemesterColumn>();
	for (const row of semesterRows) {
		const taUrutan = urutanTahunAjaran.get(row.tahunAjaranId) ?? 0;
		const namaTa = namaTahunAjaran.get(row.tahunAjaranId) ?? '-';
		semesterInfo.set(row.id, {
			semesterId: row.id,
			tahunAjaran: namaTa,
			tipe: row.tipe,
			label: `${namaTa} — ${row.nama}`,
			urut: taUrutan * 10 + (row.tipe === 'ganjil' ? 1 : 2)
		});
	}
	return [...semesterInfo.values()].sort((a, b) => a.urut - b.urut);
}

/** Daftar kelas sekolah beserta label semesternya (dipakai untuk pemilih kelas). */
export async function daftarKelasSekolah(sekolahId: number): Promise<OpsiKelas[]> {
	const semuaSemester = await daftarSemester(sekolahId);
	const labelSemester = new Map(semuaSemester.map((sem) => [sem.semesterId, sem.label]));
	const kelas = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, fase: true, semesterId: true },
		with: {
			semester: {
				columns: { id: true, nama: true },
				with: { tahunAjaran: { columns: { nama: true } } }
			}
		},
		where: eq(tableKelas.sekolahId, sekolahId)
	});
	return kelas
		.map((row) => ({
			id: row.id,
			nama: row.nama,
			fase: row.fase ?? null,
			semesterId: row.semesterId,
			semesterNama: row.semester?.nama ?? '',
			tahunAjaranNama: row.semester?.tahunAjaran?.nama ?? '',
			semesterLabel: labelSemester.get(row.semesterId) ?? '-'
		}))
		.sort(
			(a, b) =>
				collator.compare(a.semesterLabel, b.semesterLabel) || collator.compare(a.nama, b.nama)
		);
}

export async function buildRekapKeseluruhan(
	sekolahId: number,
	opsi: OpsiRekap = {}
): Promise<RekapKeseluruhan> {
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const konfigurasiDasar = {
		bobotLingkup: konfigurasi.bobotAkhir.lingkup,
		bobotSts: konfigurasi.bobotAkhir.sts,
		bobotSas: konfigurasi.bobotAkhir.sas,
		kriteriaCukup: konfigurasi.kriteriaCukup,
		kriteriaBaik: konfigurasi.kriteriaBaik
	};
	const kelasId = opsi.kelasId ?? null;

	const kelasRow = kelasId
		? await db.query.tableKelas.findFirst({
				columns: { id: true, nama: true, fase: true, semesterId: true },
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
			})
		: null;
	if (kelasId && !kelasRow) return kosong(konfigurasi);

	const kelasInfo = await db.query.tableKelas.findMany({
		columns: {
			id: true,
			nama: true,
			semesterId: true,
			raporKriteriaCukup: true,
			raporKriteriaBaik: true
		},
		where: eq(tableKelas.sekolahId, sekolahId)
	});
	const kelasMap = new Map(kelasInfo.map((row) => [row.id, row]));

	// 1) Kohort: murid kelas terpilih, atau semua murid sekolah.
	const cohort = await db.query.tableMurid.findMany({
		columns: { id: true, nama: true, nis: true, nisn: true, agama: true, kelasId: true },
		where: and(
			eq(tableMurid.sekolahId, sekolahId),
			kelasId ? eq(tableMurid.kelasId, kelasId) : undefined
		)
	});

	const identitas = new Map<
		string,
		{ nama: string; nis: string; nisn: string; agama: string | null; muridId: number }
	>();
	for (const murid of cohort) {
		const key = identityOf(murid.nis, murid.nisn);
		if (!key || identitas.has(key)) continue;
		identitas.set(key, {
			nama: murid.nama,
			nis: (murid.nis ?? '').trim(),
			nisn: (murid.nisn ?? '').trim(),
			agama: murid.agama ?? null,
			muridId: murid.id
		});
	}
	if (!identitas.size) {
		return {
			...kosong(konfigurasi),
			kelas: kelasRow
				? { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null }
				: { id: 0, nama: 'Semua Kelas', fase: null },
			konfigurasi: konfigurasiDasar
		};
	}

	// 2) Semua baris murid sekolah ini untuk menyambung riwayat per identitas.
	const semuaMurid = await db.query.tableMurid.findMany({
		columns: {
			id: true,
			nama: true,
			nis: true,
			nisn: true,
			agama: true,
			kelasId: true,
			semesterId: true
		},
		where: eq(tableMurid.sekolahId, sekolahId)
	});

	const muridCohort = new Map<number, string>();
	const kelasMurid = new Map<number, number>();
	for (const murid of semuaMurid) {
		const key = identityOf(murid.nis, murid.nisn);
		if (!key || !identitas.has(key)) continue;
		muridCohort.set(murid.id, key);
		kelasMurid.set(murid.id, murid.kelasId);
	}

	// 3) Semester (urut kronologis) dari database.
	const semuaSemester = await daftarSemester(sekolahId);
	const semesterLookup = new Map(semuaSemester.map((row) => [row.semesterId, row]));

	// 4) Mapel per kelas + semester mapel tersebut + daftar mapel & guru.
	const kelasIds = kelasInfo.map((row) => row.id);
	const semuaMapel = kelasIds.length
		? await db.query.tableMataPelajaran.findMany({
				columns: {
					id: true,
					kelasId: true,
					nama: true,
					urutan: true,
					kkm: true,
					pengampuId: true
				},
				where: inArray(tableMataPelajaran.kelasId, kelasIds)
			})
		: [];

	const pengampuIds = [
		...new Set(semuaMapel.map((row) => row.pengampuId).filter((v) => v != null))
	];
	const pegawai = pengampuIds.length
		? await db.query.tablePegawai.findMany({
				columns: { id: true, nama: true },
				where: inArray(tablePegawai.id, pengampuIds as number[])
			})
		: [];
	const namaGuru = new Map(pegawai.map((row) => [row.id, row.nama]));

	const mapelGuru = new Map<string, Map<number, string>>();
	const guruMapel = new Map<number, Set<string>>();
	const semuaNamaMapel = new Set<string>();
	for (const mapel of semuaMapel) {
		const nama = mapel.nama ?? '';
		if (!nama) continue;
		semuaNamaMapel.add(nama);
		if (mapel.pengampuId == null) continue;
		const daftarGuru = mapelGuru.get(nama) ?? new Map<number, string>();
		daftarGuru.set(mapel.pengampuId, namaGuru.get(mapel.pengampuId) ?? '-');
		mapelGuru.set(nama, daftarGuru);
		const mapelGuruList = guruMapel.get(mapel.pengampuId) ?? new Set<string>();
		mapelGuruList.add(nama);
		guruMapel.set(mapel.pengampuId, mapelGuruList);
	}

	const daftarMapel: OpsiMapel[] = [...semuaNamaMapel]
		.map((nama) => ({
			nama,
			guru: [...(mapelGuru.get(nama)?.entries() ?? [])].map(([id, namaGuru]) => ({
				id,
				nama: namaGuru
			}))
		}))
		.sort((a, b) => collator.compare(a.nama, b.nama));
	const daftarGuru: OpsiGuru[] = [...guruMapel.entries()]
		.map(([id, mapel]) => ({
			id,
			nama: namaGuru.get(id) ?? '-',
			mapel: [...mapel].sort((a, b) => collator.compare(a, b))
		}))
		.sort((a, b) => collator.compare(a.nama, b.nama));

	// Filter mata pelajaran: satu mapel, atau seluruh mapel milik seorang guru.
	const filterNamaMapel = new Set<string>();
	if (opsi.filterMapel) filterNamaMapel.add(opsi.filterMapel);
	if (opsi.pengampuId != null) {
		for (const nama of guruMapel.get(opsi.pengampuId) ?? []) filterNamaMapel.add(nama);
	}
	const adaFilter = filterNamaMapel.size > 0;

	const semesterMapel = new Map<number, number>();
	const kkmMapel = new Map<number, number>();
	// Katalog mapel per jenjang (tingkat kelas) per semester. Mapel di database
	// terpasang per kelas, sedangkan rekap memakai katalog jenjang supaya jumlah
	// mapel yang diharapkan tidak bergantung pada mapel yang kebetulan terpasang
	// di satu kelas saja.
	const katalogPerJenjang = new Map<
		string,
		Array<{ id: number; nama: string; urutan: number | null }>
	>();
	const katalogPerSemester = new Map<
		number,
		Array<{ id: number; nama: string; urutan: number | null }>
	>();
	let idSintetis = -1;
	for (const mapel of semuaMapel) {
		const kelas = kelasMap.get(mapel.kelasId);
		if (kelas) semesterMapel.set(mapel.id, kelas.semesterId);
		kkmMapel.set(mapel.id, mapel.kkm ?? 0);

		if (!kelas) continue;
		const jenjang = jenjangKelas(kelas.nama);
		const baris = {
			id: idSintetis--,
			nama: mapel.nama ?? '',
			urutan: mapel.urutan ?? null
		};
		const keyJenjang = `${kelas.semesterId}|${jenjang}`;
		const katalogJenjang = katalogPerJenjang.get(keyJenjang) ?? [];
		if (!katalogJenjang.some((row) => row.nama === baris.nama)) {
			katalogJenjang.push(baris);
			katalogPerJenjang.set(keyJenjang, katalogJenjang);
		}
		const katalogSemester = katalogPerSemester.get(kelas.semesterId) ?? [];
		if (!katalogSemester.some((row) => row.nama === baris.nama)) {
			katalogSemester.push(baris);
			katalogPerSemester.set(kelas.semesterId, katalogSemester);
		}
	}

	// 5) Nilai akhir tiap murid per mapel (komponen + nilai tersimpan).
	const muridIds = [...muridCohort.keys()];
	const mapelIds = semuaMapel.map((row) => row.id);
	const nilaiRecords =
		muridIds.length && mapelIds.length
			? await db.query.tableAsesmenSumatif.findMany({
					columns: {
						muridId: true,
						mataPelajaranId: true,
						naLingkup: true,
						sts: true,
						sas: true,
						nilaiAkhir: true
					},
					where: and(
						inArray(tableAsesmenSumatif.muridId, muridIds),
						inArray(tableAsesmenSumatif.mataPelajaranId, mapelIds)
					)
				})
			: [];

	const namaMapelId = new Map(semuaMapel.map((row) => [row.id, row.nama ?? '']));
	const pengampuMapelId = new Map(semuaMapel.map((row) => [row.id, row.pengampuId ?? null]));
	const kelasMapelId = new Map(semuaMapel.map((row) => [row.id, row.kelasId]));
	const akumulator = new Map<string, Akumulator>();
	// Agregat per mata pelajaran dan per guru untuk ringkasan dashboard.
	const akumulatorMapel = new Map<string, { sum: number; count: number; kelas: Set<number> }>();
	const akumulatorGuru = new Map<number, { sum: number; count: number; murid: Set<number> }>();
	for (const row of nilaiRecords) {
		const key = muridCohort.get(row.muridId);
		if (!key) continue;
		const semesterId = semesterMapel.get(row.mataPelajaranId);
		if (!semesterId) continue;
		const namaMapel = namaMapelId.get(row.mataPelajaranId) ?? '';
		if (adaFilter && !filterNamaMapel.has(namaMapel)) continue;
		const nilai =
			hitungNilaiAkhirSumatif(
				{ naLingkup: row.naLingkup, sts: row.sts, sas: row.sas },
				konfigurasi.bobotAkhir
			) ?? row.nilaiAkhir;
		if (nilai == null) continue;
		const mapKey = `${key}|${semesterId}`;
		const current = akumulator.get(mapKey) ?? { sum: 0, count: 0, sumKkm: 0 };
		current.sum += nilai;
		current.count += 1;
		current.sumKkm += kkmMapel.get(row.mataPelajaranId) ?? 0;
		akumulator.set(mapKey, current);

		const perMapel = akumulatorMapel.get(namaMapel) ?? {
			sum: 0,
			count: 0,
			kelas: new Set<number>()
		};
		perMapel.sum += nilai;
		perMapel.count += 1;
		const kelasDariMapel = kelasMapelId.get(row.mataPelajaranId);
		if (kelasDariMapel) perMapel.kelas.add(kelasDariMapel);
		akumulatorMapel.set(namaMapel, perMapel);

		const pengampu = pengampuMapelId.get(row.mataPelajaranId);
		if (pengampu != null) {
			const perGuru = akumulatorGuru.get(pengampu) ?? {
				sum: 0,
				count: 0,
				murid: new Set<number>()
			};
			perGuru.sum += nilai;
			perGuru.count += 1;
			perGuru.murid.add(row.muridId);
			akumulatorGuru.set(pengampu, perGuru);
		}
	}

	const rekapMapel: RekapMapel[] = [...akumulatorMapel.entries()]
		.map(([nama, data]) => ({
			nama,
			jumlahNilai: data.count,
			rataRata: data.count > 0 ? round2(data.sum / data.count) : null,
			kelas: data.kelas.size,
			guru: [...(mapelGuru.get(nama)?.values() ?? [])].sort((a, b) => collator.compare(a, b))
		}))
		.sort((a, b) => collator.compare(a.nama, b.nama));

	const rekapGuru: RekapGuru[] = [...akumulatorGuru.entries()]
		.map(([id, data]) => ({
			id,
			nama: namaGuru.get(id) ?? '-',
			mapel: [...(guruMapel.get(id) ?? [])].sort((a, b) => collator.compare(a, b)),
			jumlahNilai: data.count,
			jumlahMurid: data.murid.size,
			rataRata: data.count > 0 ? round2(data.sum / data.count) : null
		}))
		.sort((a, b) => collator.compare(a.nama, b.nama));

	// 6) Kelas yang diikuti murid pada tiap semester.
	const kelasPerSemesterMurid = new Map<string, number>();
	for (const [muridId, key] of muridCohort) {
		const kelasIdMurid = kelasMurid.get(muridId);
		if (!kelasIdMurid) continue;
		const kelas = kelasMap.get(kelasIdMurid);
		if (!kelas) continue;
		kelasPerSemesterMurid.set(`${key}|${kelas.semesterId}`, kelasIdMurid);
	}

	// 6b) Baris murid pada semester terbaru — dipakai saat memindahkan kelas
	//     (yang harus mengubah baris semester berjalan, bukan baris lama).
	const muridAktif = new Map<string, { id: number; urut: number }>();
	for (const [muridId, key] of muridCohort) {
		const kelasIdMurid = kelasMurid.get(muridId);
		const semesterId = kelasIdMurid ? kelasMap.get(kelasIdMurid)?.semesterId : undefined;
		const urut = semesterId ? (semesterLookup.get(semesterId)?.urut ?? 0) : 0;
		const sekarang = muridAktif.get(key);
		if (!sekarang || urut > sekarang.urut) {
			muridAktif.set(key, { id: muridId, urut });
		}
	}

	// 7) Semester yang dipakai: dari semester pertama sampai semester terakhir
	//    yang ada murid kelas ini.
	const semesterTerpakai = new Set<number>();
	for (const key of kelasPerSemesterMurid.keys()) {
		const semesterId = Number(key.split('|')[1]);
		if (semesterLookup.has(semesterId)) semesterTerpakai.add(semesterId);
	}
	for (const key of akumulator.keys()) {
		const semesterId = Number(key.split('|')[1]);
		if (semesterLookup.has(semesterId)) semesterTerpakai.add(semesterId);
	}
	const kolomSemester = semuaSemester.filter((sem) => semesterTerpakai.has(sem.semesterId));

	if (!kolomSemester.length) {
		return {
			...kosong(konfigurasi),
			kelas: kelasRow
				? { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null }
				: { id: 0, nama: 'Semua Kelas', fase: null },
			daftarMapel,
			daftarGuru,
			rekapMapel,
			rekapGuru,
			konfigurasi: konfigurasiDasar
		};
	}

	// 8) Total mapel yang diharapkan per jenjang+semester (mengikuti varian agama
	//    murid). Katalog memakai gabungan mapel seluruh kelas pada jenjang yang
	//    sama, bukan hanya mapel kelas yang sedang dipilih.
	const cacheTotalMapel = new Map<string, number>();
	function totalMapelUntuk(semesterId: number, jenjang: string, agama: string | null) {
		const cacheKey = `${semesterId}|${jenjang}|${agama ?? ''}`;
		const cached = cacheTotalMapel.get(cacheKey);
		if (cached !== undefined) return cached;
		const katalog =
			katalogPerJenjang.get(`${semesterId}|${jenjang}`) ?? katalogPerSemester.get(semesterId) ?? [];
		const katalogTersaring = adaFilter
			? katalog.filter((row) => filterNamaMapel.has(row.nama))
			: katalog;
		const total = relevanMapelUntukMurid(katalogTersaring, agama).length;
		cacheTotalMapel.set(cacheKey, total);
		return total;
	}

	/** Ambang kriteria kelas (penimpaan per kelas) atau bawaan sekolah. */
	function kriteriaKelas(kelasIdKelas: number | null) {
		const kelas = kelasIdKelas ? kelasMap.get(kelasIdKelas) : null;
		return {
			cukup: Number(kelas?.raporKriteriaCukup ?? konfigurasi.kriteriaCukup ?? 85),
			baik: Number(kelas?.raporKriteriaBaik ?? konfigurasi.kriteriaBaik ?? 95)
		};
	}

	const baris: BarisRekap[] = [];
	const ringkasanSemester = new Map<number, Akumulator>();
	// Kelas yang paling banyak diikuti murid pada tiap semester — dipakai untuk
	// ambang kriteria saat menghitung rata-rata kelas.
	const kelasPerSemesterHitung = new Map<number, Map<number, number>>();

	for (const [key, info] of identitas) {
		const perSemester: SelRekap[] = kolomSemester.map((sem) => {
			const kelasIdMurid = kelasPerSemesterMurid.get(`${key}|${sem.semesterId}`) ?? null;
			if (kelasIdMurid) {
				const hitung = kelasPerSemesterHitung.get(sem.semesterId) ?? new Map<number, number>();
				hitung.set(kelasIdMurid, (hitung.get(kelasIdMurid) ?? 0) + 1);
				kelasPerSemesterHitung.set(sem.semesterId, hitung);
			}
			const kelasNama = kelasIdMurid ? (kelasMap.get(kelasIdMurid)?.nama ?? null) : null;
			const jenjang = jenjangKelas(kelasNama);
			const akum = akumulator.get(`${key}|${sem.semesterId}`);
			const total = jenjang ? totalMapelUntuk(sem.semesterId, jenjang, info.agama) : 0;
			const nilai = akum && akum.count > 0 ? round2(akum.sum / akum.count) : null;
			const rataKkm = akum && akum.count > 0 ? round2(akum.sumKkm / akum.count) : null;
			const ambang = kriteriaKelas(kelasIdMurid);
			return {
				semesterId: sem.semesterId,
				kelasNama,
				nilai,
				dinilai: akum?.count ?? 0,
				total,
				kriteria:
					nilai == null ? null : determinePredikat(nilai, rataKkm, ambang.cukup, ambang.baik).label,
				rataKkm
			};
		});

		let sumKumulatif = 0;
		let countKumulatif = 0;
		let sumKkmKumulatif = 0;
		for (const sem of kolomSemester) {
			const akum = akumulator.get(`${key}|${sem.semesterId}`);
			if (!akum || akum.count === 0) continue;
			sumKumulatif += akum.sum;
			countKumulatif += akum.count;
			sumKkmKumulatif += akum.sumKkm;
			const rekap = ringkasanSemester.get(sem.semesterId) ?? { sum: 0, count: 0, sumKkm: 0 };
			rekap.sum += akum.sum;
			rekap.count += akum.count;
			rekap.sumKkm += akum.sumKkm;
			ringkasanSemester.set(sem.semesterId, rekap);
		}

		const rataKumulatif = countKumulatif > 0 ? round2(sumKumulatif / countKumulatif) : null;
		const rataKkmKumulatif = countKumulatif > 0 ? round2(sumKkmKumulatif / countKumulatif) : null;
		const semesterTerakhirMurid = kolomSemester[kolomSemester.length - 1];
		const ambangKumulatif = kriteriaKelas(
			semesterTerakhirMurid
				? (kelasPerSemesterMurid.get(`${key}|${semesterTerakhirMurid.semesterId}`) ?? null)
				: null
		);
		const kelasSekarangId = info.muridId ? kelasMurid.get(info.muridId) : null;

		baris.push({
			key,
			muridId: muridAktif.get(key)?.id ?? info.muridId,
			nis: info.nis,
			nisn: info.nisn,
			nama: info.nama,
			kelasSekarang: kelasSekarangId ? (kelasMap.get(kelasSekarangId)?.nama ?? null) : null,
			perSemester,
			rataKumulatif,
			kriteriaKumulatif:
				rataKumulatif == null
					? null
					: determinePredikat(
							rataKumulatif,
							rataKkmKumulatif,
							ambangKumulatif.cukup,
							ambangKumulatif.baik
						).label,
			totalDinilai: countKumulatif,
			peringkat: 0
		});
	}

	baris.sort((a, b) => {
		const aNilai = a.rataKumulatif;
		const bNilai = b.rataKumulatif;
		if (aNilai == null && bNilai == null) return a.nama.localeCompare(b.nama, 'id');
		if (aNilai == null) return 1;
		if (bNilai == null) return -1;
		const selisih = bNilai - aNilai;
		if (Math.abs(selisih) > 0.0001) return selisih;
		return a.nama.localeCompare(b.nama, 'id');
	});

	let peringkatTerakhir: number | null = null;
	let nilaiTerakhir: number | null = null;
	baris.forEach((row, index) => {
		const nilai = row.rataKumulatif;
		let peringkat = index + 1;
		if (nilai != null) {
			if (nilaiTerakhir != null && Math.abs(nilaiTerakhir - nilai) <= 0.0001) {
				peringkat = peringkatTerakhir ?? peringkat;
			} else {
				nilaiTerakhir = nilai;
				peringkatTerakhir = peringkat;
			}
		} else {
			nilaiTerakhir = null;
			peringkatTerakhir = peringkat;
		}
		row.peringkat = peringkat;
	});

	return {
		kelas: kelasRow
			? { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null }
			: { id: 0, nama: 'Semua Kelas', fase: null },
		semester: kolomSemester,
		baris,
		ringkasan: kolomSemester.map((sem) => {
			const akum = ringkasanSemester.get(sem.semesterId);
			const nilai = akum && akum.count > 0 ? round2(akum.sum / akum.count) : null;
			const rataKkm = akum && akum.count > 0 ? round2(akum.sumKkm / akum.count) : null;
			const hitungKelas = kelasPerSemesterHitung.get(sem.semesterId);
			const kelasTerbanyak = hitungKelas
				? ([...hitungKelas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
				: null;
			const ambang = kriteriaKelas(kelasTerbanyak);
			return {
				semesterId: sem.semesterId,
				nilai,
				dinilai: akum?.count ?? 0,
				kriteria:
					nilai == null ? null : determinePredikat(nilai, rataKkm, ambang.cukup, ambang.baik).label
			};
		}),
		totalMurid: baris.length,
		totalDinilai: baris.filter((row) => row.totalDinilai > 0).length,
		daftarMapel,
		daftarGuru,
		rekapMapel,
		rekapGuru,
		konfigurasi: konfigurasiDasar
	};
}
