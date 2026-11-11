import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import {
	tableAsesmenEkstrakurikuler,
	tableAsesmenSumatif,
	tableAsesmenKokurikuler,
	tableBellSettings,
	tableEkstrakurikuler,
	tableKokurikuler,
	tableKehadiranMurid,
	tableKegiatanCustom,
	tableKelas,
	tableJadwalPelajaran,
	tableMataPelajaran,
	tableMurid,
	tablePresensiSettings,
	tableUserFavorites
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { getRingkasanKelas } from '$lib/server/statistik-kelas';

const AGAMA_BASE_SUBJECT = 'Pendidikan Agama dan Budi Pekerti';

type MataPelajaranJenis = 'wajib' | 'mulok' | 'pilihan';

type SubjectBucket = {
	jenis: MataPelajaranJenis;
	mapelIds: Set<number>;
};

const normalizeText = (value: string | null | undefined) =>
	(value ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();

const isAgamaSubject = (name: string | null | undefined) =>
	/^pendidikan (agama|kepercayaan)/i.test(normalizeText(name));

const calculatePercentage = (completed: number, total: number) =>
	total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

export async function load(event) {
	const parentData = await event.parent();
	const sekolahId = event.locals.sekolah?.id ?? null;

	const statistikDashboard = {
		rombel: {
			total: 0,
			perFase: [] as Array<{ fase: string | null; label: string; jumlah: number }>
		},
		murid: {
			total: 0
		},
		mapel: {
			total: 0,
			/** Jumlah baris mapel kelas aktif (termasuk varian agama). */
			baris: 0,
			wajib: 0,
			mulok: 0,
			kokurikuler: 0,
			lainnya: 0
		},
		ekstrakurikuler: {
			total: 0
		},
		progress: {
			akademik: { percentage: 0, completed: 0, total: 0 },
			absensi: { percentage: 0, completed: 0, total: 0 },
			ekstrakurikuler: { percentage: 0, completed: 0, total: 0 },
			kokurikuler: { percentage: 0, completed: 0, total: 0 }
		}
	};

	if (!sekolahId) {
		return {
			...parentData,
			statistikDashboard
		};
	}

	const academicContext = await resolveSekolahAcademicContext(sekolahId);
	const activeSemesterId = academicContext?.activeSemesterId ?? null;

	const kelasFilter = activeSemesterId
		? and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, activeSemesterId))
		: eq(tableKelas.sekolahId, sekolahId);

	const daftarKelas = await db.query.tableKelas.findMany({
		columns: { id: true, fase: true },
		where: kelasFilter
	});

	statistikDashboard.rombel.total = daftarKelas.length;

	const perFaseMap = new Map<string | null, number>();
	for (const kelas of daftarKelas) {
		const key = kelas.fase ?? null;
		perFaseMap.set(key, (perFaseMap.get(key) ?? 0) + 1);
	}

	statistikDashboard.rombel.perFase = Array.from(perFaseMap.entries())
		.map(([fase, jumlah]) => ({
			fase,
			label: fase ?? 'Belum diatur',
			jumlah
		}))
		.sort((a, b) => a.label.localeCompare(b.label, 'id'));

	const muridFilter = activeSemesterId
		? and(eq(tableMurid.sekolahId, sekolahId), eq(tableMurid.semesterId, activeSemesterId))
		: eq(tableMurid.sekolahId, sekolahId);

	const muridCountRows = await db
		.select({ totalMurid: sql<number>`count(*)` })
		.from(tableMurid)
		.where(muridFilter);

	statistikDashboard.murid.total = muridCountRows[0]?.totalMurid ?? 0;

	const kelasAktifId = (parentData.kelasAktif ?? null)?.id ?? null;

	if (kelasAktifId) {
		const mataPelajaranRows = await db.query.tableMataPelajaran.findMany({
			columns: { id: true, nama: true, jenis: true },
			where: and(
				eq(tableMataPelajaran.kelasId, kelasAktifId),
				eq(tableMataPelajaran.kategori, 'intrakurikuler')
			)
		});

		const uniqueSubjects = new Map<string, SubjectBucket>();

		for (const mapel of mataPelajaranRows) {
			const trimmedName = mapel.nama?.trim() ?? '';
			const key = isAgamaSubject(mapel.nama)
				? AGAMA_BASE_SUBJECT
				: trimmedName || `Mata Pelajaran ${mapel.id}`;
			const jenis = (mapel.jenis ?? 'wajib') as MataPelajaranJenis;
			let bucket = uniqueSubjects.get(key);
			if (!bucket) {
				bucket = { jenis, mapelIds: new Set<number>([mapel.id]) };
				uniqueSubjects.set(key, bucket);
			} else {
				if (bucket.jenis !== 'mulok' && jenis === 'mulok') {
					bucket.jenis = 'mulok';
				}
				bucket.mapelIds.add(mapel.id);
			}
		}

		const uniqueSubjectValues = Array.from(uniqueSubjects.values());
		statistikDashboard.mapel.total = uniqueSubjectValues.length;
		// Jumlah baris mapel (tanpa menggabungkan varian agama) — angka yang sama
		// dengan tabel "Mapel" per kelas di /semua-kelas dan /semua-kelas/[id].
		statistikDashboard.mapel.baris = mataPelajaranRows.length;
		statistikDashboard.mapel.wajib = uniqueSubjectValues.filter(
			(item) => item.jenis === 'wajib'
		).length;
		statistikDashboard.mapel.mulok = uniqueSubjectValues.filter(
			(item) => item.jenis === 'mulok'
		).length;
		statistikDashboard.mapel.lainnya = uniqueSubjectValues.filter(
			(item) => item.jenis === 'pilihan'
		).length;

		const ekstrakurikulerRows = await db.query.tableEkstrakurikuler.findMany({
			columns: { id: true },
			// Ekstra umum (semuaKelas=1) ikut dihitung untuk setiap kelas.
			where: or(
				eq(tableEkstrakurikuler.kelasId, kelasAktifId),
				eq(tableEkstrakurikuler.semuaKelas, 1)
			)
		});
		statistikDashboard.ekstrakurikuler.total = ekstrakurikulerRows.length;

		// kokurikuler (separate table) — tampilkan jumlahnya di bagian Intrakurikuler
		const kokurikulerRows = await db.query.tableKokurikuler.findMany({
			columns: { id: true },
			where: eq(tableKokurikuler.kelasId, kelasAktifId)
		});
		statistikDashboard.mapel.kokurikuler = kokurikulerRows.length;

		// debug: show kokurikuler count for active class in server logs to help troubleshooting
		console.info(
			'[dashboard] kelasAktifId=%s kokurikuler=%d mapel=%o',
			kelasAktifId,
			kokurikulerRows.length,
			{
				total: statistikDashboard.mapel.total,
				wajib: statistikDashboard.mapel.wajib,
				mulok: statistikDashboard.mapel.mulok,
				kokurikuler: statistikDashboard.mapel.kokurikuler,
				lainnya: statistikDashboard.mapel.lainnya
			}
		);

		const muridRows = await db.query.tableMurid.findMany({
			columns: { id: true },
			where: eq(tableMurid.kelasId, kelasAktifId)
		});
		const muridIds = muridRows.map((murid) => murid.id);
		const totalStudents = muridIds.length;
		const totalMapelBaris = mataPelajaranRows.length;
		const mapelIdList = mataPelajaranRows.map((mapel) => mapel.id);

		let akademikCompleted = 0;
		if (totalStudents > 0 && totalMapelBaris > 0) {
			const sumatifRows = await db
				.select({
					muridId: tableAsesmenSumatif.muridId,
					mataPelajaranId: tableAsesmenSumatif.mataPelajaranId
				})
				.from(tableAsesmenSumatif)
				.where(
					and(
						inArray(tableAsesmenSumatif.muridId, muridIds),
						inArray(tableAsesmenSumatif.mataPelajaranId, mapelIdList)
					)
				);

			const completedPairs = new Set<string>();
			for (const row of sumatifRows) {
				completedPairs.add(`${row.muridId}:${row.mataPelajaranId}`);
			}
			akademikCompleted = completedPairs.size;
		}
		// Denominator mengikuti jumlah baris mapel (sama dengan /semua-kelas/[id]:
		// murid × baris mapel), bukan jumlah mapel unik hasil penggabungan varian
		// agama — supaya persentase tidak bertentangan dengan kartu/daftar mapel.
		const expectedAcademic = totalStudents * totalMapelBaris;

		let absensiCompleted = 0;
		if (totalStudents > 0) {
			const attendanceRows = await db
				.select({ muridId: tableKehadiranMurid.muridId })
				.from(tableKehadiranMurid)
				.where(inArray(tableKehadiranMurid.muridId, muridIds));

			const attendanceSet = new Set(attendanceRows.map((row) => row.muridId));
			absensiCompleted = attendanceSet.size;
		}

		let ekstrakCompleted = 0;
		if (totalStudents > 0) {
			const asesmenEkstrakRows = await db
				.select({ muridId: tableAsesmenEkstrakurikuler.muridId })
				.from(tableAsesmenEkstrakurikuler)
				.where(inArray(tableAsesmenEkstrakurikuler.muridId, muridIds));

			const ekstrakSet = new Set(asesmenEkstrakRows.map((row) => row.muridId));
			ekstrakCompleted = ekstrakSet.size;
		}

		let kokurCompleted = 0;
		if (totalStudents > 0) {
			const asesmenKokurRows = await db
				.select({ muridId: tableAsesmenKokurikuler.muridId })
				.from(tableAsesmenKokurikuler)
				.where(inArray(tableAsesmenKokurikuler.muridId, muridIds));

			const kokurSet = new Set(asesmenKokurRows.map((row) => row.muridId));
			kokurCompleted = kokurSet.size;
		}

		statistikDashboard.progress = {
			akademik: {
				completed: akademikCompleted,
				total: expectedAcademic,
				percentage: calculatePercentage(akademikCompleted, expectedAcademic)
			},
			absensi: {
				completed: absensiCompleted,
				total: totalStudents,
				percentage: calculatePercentage(absensiCompleted, totalStudents)
			},
			ekstrakurikuler: {
				completed: ekstrakCompleted,
				total: totalStudents,
				percentage: calculatePercentage(ekstrakCompleted, totalStudents)
			},
			kokurikuler: {
				completed: kokurCompleted,
				total: totalStudents,
				percentage: calculatePercentage(kokurCompleted, totalStudents)
			}
		};
	} else if (sekolahId) {
		// Mode "Semua Kelas" (admin/kepala sekolah di luar kelas): statistik mapel
		// dihitung lintas rombel semester aktif agar kartu tidak lagi menulis 0
		// padahal tabel per kelas berisi mapel.
		const kelasIds = daftarKelas.map((kelas) => kelas.id);
		if (kelasIds.length > 0) {
			const semuaMapelRows = await db.query.tableMataPelajaran.findMany({
				columns: { id: true, nama: true, jenis: true },
				where: and(
					inArray(tableMataPelajaran.kelasId, kelasIds),
					eq(tableMataPelajaran.kategori, 'intrakurikuler')
				)
			});
			const namaUnik = new Map<string, MataPelajaranJenis>();
			for (const mapel of semuaMapelRows) {
				const trimmedName = mapel.nama?.trim() ?? '';
				const key = isAgamaSubject(mapel.nama)
					? AGAMA_BASE_SUBJECT
					: trimmedName || `Mata Pelajaran ${mapel.id}`;
				const jenis = (mapel.jenis ?? 'wajib') as MataPelajaranJenis;
				const ada = namaUnik.get(key);
				if (!ada) namaUnik.set(key, jenis);
				else if (ada !== 'mulok' && jenis === 'mulok') namaUnik.set(key, 'mulok');
			}
			const jenisUnik = [...namaUnik.values()];
			statistikDashboard.mapel.total = namaUnik.size;
			statistikDashboard.mapel.baris = semuaMapelRows.length;
			statistikDashboard.mapel.wajib = jenisUnik.filter((jenis) => jenis === 'wajib').length;
			statistikDashboard.mapel.mulok = jenisUnik.filter((jenis) => jenis === 'mulok').length;
			statistikDashboard.mapel.lainnya = jenisUnik.filter((jenis) => jenis === 'pilihan').length;
		}

		const [ekstraRows, kokurRows] = await Promise.all([
			db.query.tableEkstrakurikuler.findMany({
				columns: { id: true },
				where: eq(tableEkstrakurikuler.semuaKelas, 1)
			}),
			kelasIds.length
				? db.query.tableKokurikuler.findMany({
						columns: { id: true },
						where: inArray(tableKokurikuler.kelasId, kelasIds)
					})
				: Promise.resolve([])
		]);
		statistikDashboard.ekstrakurikuler.total = ekstraRows.length;
		statistikDashboard.mapel.kokurikuler = kokurRows.length;
	}

	const [bellRow, presensiRow, kegiatanCustom, jadwalPelajaran] = await Promise.all([
		sekolahId
			? db.query.tableBellSettings.findFirst({
					where: eq(tableBellSettings.sekolahId, sekolahId)
				})
			: Promise.resolve(null),
		sekolahId
			? db.query.tablePresensiSettings.findFirst({
					columns: {
						hariSekolah: true,
						hariSekolahCustom: true,
						jamPulang: true,
						liburNasional: true,
						liburSemester: true
					},
					where: eq(tablePresensiSettings.sekolahId, sekolahId),
					orderBy: [desc(tablePresensiSettings.id)]
				})
			: Promise.resolve(null),
		sekolahId
			? db.query.tableKegiatanCustom.findMany({
					where: eq(tableKegiatanCustom.sekolahId, sekolahId),
					columns: { kode: true, nama: true, durasi: true }
				})
			: Promise.resolve([]),
		sekolahId
			? db.query.tableJadwalPelajaran.findMany({
					where: eq(tableJadwalPelajaran.sekolahId, sekolahId),
					columns: { hari: true, jamKe: true, kelasId: true, kodeKegiatan: true }
				})
			: Promise.resolve([])
	]);

	let daftarKodeMapel: string[] = [];
	if (sekolahId) {
		const kelasIds = daftarKelas.map((k) => k.id);
		if (kelasIds.length > 0) {
			const mapelRows = await db.query.tableMataPelajaran.findMany({
				where: inArray(tableMataPelajaran.kelasId, kelasIds),
				columns: { kode: true }
			});
			daftarKodeMapel = [...new Set(mapelRows.map((r) => r.kode).filter(Boolean))] as string[];
		}
	}

	const hariSekolah = presensiRow?.hariSekolah ?? 6;
	const hariSekolahCustom = presensiRow?.hariSekolahCustom ?? null;

	let liburNasional: string[] = [];
	let liburSemester: Array<{ start: string; end: string }> = [];
	if (presensiRow) {
		try {
			const parsed = JSON.parse(presensiRow.liburNasional || '[]');
			if (Array.isArray(parsed)) liburNasional = parsed;
		} catch {
			// ignore
		}
		try {
			const parsed = JSON.parse(presensiRow.liburSemester || '[]');
			if (Array.isArray(parsed)) liburSemester = parsed;
		} catch {
			// ignore
		}
	}

	const userId = event.locals.user?.id;
	const favorites = userId
		? await db.query.tableUserFavorites.findMany({
				where: eq(tableUserFavorites.userId, userId),
				orderBy: (fav, { asc }) => [asc(fav.createdAt)]
			})
		: [];

	// Ringkasan seluruh kelas untuk monitoring admin/kepala sekolah.
	const userType = event.locals.user?.type;
	const canSeeRingkasanKelas = userType === 'admin' || userType === 'kepala_sekolah';
	let ringkasanKelas: {
		ringkasan: Awaited<ReturnType<typeof getRingkasanKelas>>['ringkasan'];
		daftarKelas: Awaited<ReturnType<typeof getRingkasanKelas>>['daftarKelas'];
	} | null = null;

	if (canSeeRingkasanKelas && sekolahId) {
		const hasil = await getRingkasanKelas(sekolahId, activeSemesterId);
		ringkasanKelas = { ringkasan: hasil.ringkasan, daftarKelas: hasil.daftarKelas };
		// Satu sumber hitungan: progress nilai akademik memakai angka yang sama
		// dengan kartu "Ringkasan Semua Kelas" / halaman /semua-kelas, supaya
		// dashboard tidak menampilkan persentase yang berbeda untuk data yang sama.
		const nilaiTerisi = ringkasanKelas.daftarKelas.reduce(
			(total, kelas) => total + kelas.nilaiTerisi,
			0
		);
		const nilaiDiharapkan = ringkasanKelas.daftarKelas.reduce(
			(total, kelas) => total + kelas.nilaiDiharapkan,
			0
		);
		statistikDashboard.progress.akademik = {
			completed: nilaiTerisi,
			total: nilaiDiharapkan,
			percentage: calculatePercentage(nilaiTerisi, nilaiDiharapkan)
		};
	}

	return {
		...parentData,
		favorites,
		statistikDashboard,
		ringkasanKelas,
		bellActive: bellRow?.isActive === 1,
		hariSekolah,
		hariSekolahCustom,
		liburNasional,
		liburSemester,
		bellSettings: bellRow
			? {
					jamMulai: bellRow.jamMulai,
					jamPelajaranMenit: bellRow.jamPelajaranMenit,
					durasiIstirahat: bellRow.durasiIstirahat,
					durasiUpacara: bellRow.durasiUpacara
				}
			: null,
		kegiatanCustom,
		jadwalPelajaran,
		daftarKodeMapel
	};
}
