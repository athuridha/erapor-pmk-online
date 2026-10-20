import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
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
 * Rekap nilai keseluruhan satu kelas: nilai tiap murid dari semester pertama
 * ia masuk sekolah sampai semester terakhir.
 *
 * Semuanya berasal dari database:
 * - Semester & kelas dari `tahun_ajaran`, `semester`, `kelas`.
 * - Nilai akhir dihitung ulang dari komponen lingkup/STS/SAS memakai bobot
 *   sekolah (bila komponen ada), jika tidak dipakai nilai akhir tersimpan.
 * - Ambang kriteria (Cukup/Baik) mengikuti `sekolah.rapor_kriteria_*` atau
 *   penimpaan per kelas di `kelas.rapor_kriteria_*`.
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
	nis: string;
	nisn: string;
	nama: string;
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
}

export interface RekapKeseluruhan {
	kelas: { id: number; nama: string; fase: string | null };
	semester: SemesterColumn[];
	baris: BarisRekap[];
	ringkasan: RingkasanSemester[];
	totalMurid: number;
	totalDinilai: number;
	konfigurasi: {
		bobotLingkup: number;
		bobotSts: number;
		bobotSas: number;
		kriteriaCukup: number;
		kriteriaBaik: number;
	};
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

function semesterInfoDari(list: SemesterColumn[]) {
	return list.map((row) => [row.semesterId, row] as const);
}

function kosong(konfigurasi?: KonfigurasiNilai): RekapKeseluruhan {
	return {
		kelas: { id: 0, nama: '-', fase: null },
		semester: [],
		baris: [],
		ringkasan: [],
		totalMurid: 0,
		totalDinilai: 0,
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
		where: eq(tableKelas.sekolahId, sekolahId)
	});
	return kelas
		.map((row) => ({
			id: row.id,
			nama: row.nama,
			fase: row.fase ?? null,
			semesterLabel: labelSemester.get(row.semesterId) ?? '-'
		}))
		.sort(
			(a, b) =>
				collator.compare(a.semesterLabel, b.semesterLabel) || collator.compare(a.nama, b.nama)
		);
}

export async function buildRekapKeseluruhan(
	sekolahId: number,
	kelasId: number
): Promise<RekapKeseluruhan> {
	const konfigurasi = await loadKonfigurasiNilai(sekolahId);
	const konfigurasiDasar = {
		bobotLingkup: konfigurasi.bobotAkhir.lingkup,
		bobotSts: konfigurasi.bobotAkhir.sts,
		bobotSas: konfigurasi.bobotAkhir.sas,
		kriteriaCukup: konfigurasi.kriteriaCukup,
		kriteriaBaik: konfigurasi.kriteriaBaik
	};

	const kelasRow = await db.query.tableKelas.findFirst({
		columns: { id: true, nama: true, fase: true, semesterId: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelasRow) return kosong(konfigurasi);

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

	// 1) Kohort: murid di kelas yang dipilih.
	const cohort = await db.query.tableMurid.findMany({
		columns: { id: true, nama: true, nis: true, nisn: true, agama: true, kelasId: true },
		where: and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.kelasId, kelasId))
	});

	const identitas = new Map<
		string,
		{ nama: string; nis: string; nisn: string; agama: string | null }
	>();
	for (const murid of cohort) {
		const key = identityOf(murid.nis, murid.nisn);
		if (!key || identitas.has(key)) continue;
		identitas.set(key, {
			nama: murid.nama,
			nis: (murid.nis ?? '').trim(),
			nisn: (murid.nisn ?? '').trim(),
			agama: murid.agama ?? null
		});
	}
	if (!identitas.size) {
		return {
			...kosong(konfigurasi),
			kelas: { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null },
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
	const semesterLookup = new Map(semesterInfoDari(semuaSemester));

	// 4) Mapel per kelas + semester mapel tersebut.
	const kelasIds = kelasInfo.map((row) => row.id);
	const semuaMapel = kelasIds.length
		? await db.query.tableMataPelajaran.findMany({
				columns: { id: true, kelasId: true, nama: true, urutan: true, kkm: true },
				where: inArray(tableMataPelajaran.kelasId, kelasIds)
			})
		: [];
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

	const akumulator = new Map<string, Akumulator>();
	for (const row of nilaiRecords) {
		const key = muridCohort.get(row.muridId);
		if (!key) continue;
		const semesterId = semesterMapel.get(row.mataPelajaranId);
		if (!semesterId) continue;
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
	}

	// 6) Kelas yang diikuti murid pada tiap semester.
	const kelasPerSemesterMurid = new Map<string, number>();
	for (const [muridId, key] of muridCohort) {
		const kelasId = kelasMurid.get(muridId);
		if (!kelasId) continue;
		const kelas = kelasMap.get(kelasId);
		if (!kelas) continue;
		kelasPerSemesterMurid.set(`${key}|${kelas.semesterId}`, kelasId);
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
			kelas: { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null },
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
		const total = relevanMapelUntukMurid(katalog, agama).length;
		cacheTotalMapel.set(cacheKey, total);
		return total;
	}

	/** Ambang kriteria kelas (penimpaan per kelas) atau bawaan sekolah. */
	function kriteriaKelas(kelasId: number | null) {
		const kelas = kelasId ? kelasMap.get(kelasId) : null;
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
			const kelasId = kelasPerSemesterMurid.get(`${key}|${sem.semesterId}`) ?? null;
			if (kelasId) {
				const hitung = kelasPerSemesterHitung.get(sem.semesterId) ?? new Map<number, number>();
				hitung.set(kelasId, (hitung.get(kelasId) ?? 0) + 1);
				kelasPerSemesterHitung.set(sem.semesterId, hitung);
			}
			const kelasNama = kelasId ? (kelasMap.get(kelasId)?.nama ?? null) : null;
			const jenjang = jenjangKelas(kelasNama);
			const akum = akumulator.get(`${key}|${sem.semesterId}`);
			const total = jenjang ? totalMapelUntuk(sem.semesterId, jenjang, info.agama) : 0;
			const nilai = akum && akum.count > 0 ? round2(akum.sum / akum.count) : null;
			const rataKkm = akum && akum.count > 0 ? round2(akum.sumKkm / akum.count) : null;
			const ambang = kriteriaKelas(kelasId);
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
		const ambangKumulatif = kriteriaKelas(
			kelasPerSemesterMurid.get(`${key}|${kolomSemester[kolomSemester.length - 1].semesterId}`) ??
				null
		);

		baris.push({
			key,
			nis: info.nis,
			nisn: info.nisn,
			nama: info.nama,
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
		kelas: { id: kelasRow.id, nama: kelasRow.nama, fase: kelasRow.fase ?? null },
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
		konfigurasi: konfigurasiDasar
	};
}
