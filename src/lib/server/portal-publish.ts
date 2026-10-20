import { env } from '$env/dynamic/private';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableCatatanWaliKelas,
	tableJadwalPelajaran,
	tableKelas,
	tableKetidakhadiranRapor,
	tableMataPelajaran,
	tableMurid,
	tablePortalOrangtua,
	tablePortalOrangtuaMurid,
	tableSekolah,
	tableSemester,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { executeD1Query, getD1Config, type D1Config } from '$lib/server/cloudflare-d1';
import { personSignatureDataUrl } from '$lib/server/ttd';

/** D1 khusus portal; jangan pakai database pusat e-Rapor. */
export const PORTAL_D1_DATABASE_ID =
	env.PORTAL_D1_DATABASE_ID?.trim() ||
	process.env.PORTAL_D1_DATABASE_ID?.trim() ||
	'bbaeedd9-5622-4d17-af03-b726e7fba400';

type Row = Record<string, unknown>;

interface D1QueryResult {
	results?: Row[];
	meta?: { last_row_id?: number; changes?: number };
}

export interface PortalPublishResult {
	students: number;
	parents: number;
	links: number;
	grades: number;
	attendance: number;
	schedules: number;
	subjects: number;
}

function portalConfig(base: D1Config): D1Config {
	const apiToken = (env.PORTAL_D1_API_TOKEN || process.env.PORTAL_D1_API_TOKEN)?.trim();
	return {
		...base,
		databaseId: PORTAL_D1_DATABASE_ID,
		...(apiToken ? { apiToken, tokenSource: 'env' as const } : {})
	};
}

async function d1(config: D1Config, sql: string, params: unknown[] = []): Promise<D1QueryResult[]> {
	const result = await executeD1Query(config, sql, params);
	if (!result.success) {
		throw new Error(result.error || 'Kueri D1 portal gagal.');
	}
	return (result.result as D1QueryResult[] | undefined) ?? [];
}

async function insertRows(
	config: D1Config,
	table: string,
	columns: string[],
	rows: Row[]
): Promise<void> {
	if (rows.length === 0) return;
	const chunkSize = Math.max(1, Math.floor(100 / columns.length));
	for (let start = 0; start < rows.length; start += chunkSize) {
		const chunk = rows.slice(start, start + chunkSize);
		const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
		const params = chunk.flatMap((row) => columns.map((column) => row[column] ?? null));
		await d1(config, `insert into ${table} (${columns.join(', ')}) values ${placeholders}`, params);
	}
}

function asDataUrl(blob: Uint8Array | null | undefined, mime: string | null | undefined) {
	if (!blob || blob.length === 0) return null;
	const type = mime || 'image/png';
	return `data:${type};base64,${Buffer.from(blob).toString('base64')}`;
}

function composeAddress(
	alamat:
		| {
				jalan: string;
				desa: string;
				kecamatan: string;
				kabupaten: string;
				provinsi: string | null;
				kodePos: string | null;
		  }
		| undefined
): string | null {
	if (!alamat) return null;
	return [
		alamat.jalan,
		alamat.desa,
		alamat.kecamatan,
		alamat.kabupaten,
		alamat.provinsi,
		alamat.kodePos
	]
		.filter((part) => part && part !== 'Belum diisi')
		.join(', ');
}

function scheduleLabel(
	kode: string,
	mapelNames: Map<string, string>
): { nama: string; jenis: string } {
	const normalized = kode.trim().toLowerCase();
	if (/^\d+$/.test(normalized)) {
		const name = mapelNames.get(normalized);
		if (name) return { nama: name, jenis: 'mapel' };
	}
	if (normalized.includes('upacara')) return { nama: 'Upacara bendera', jenis: 'upacara' };
	if (normalized.includes('istirahat')) return { nama: 'Istirahat', jenis: 'istirahat' };
	if (normalized.includes('pulang')) return { nama: 'Pulang', jenis: 'pulang' };
	if (normalized.includes('sholat') || normalized.includes('ibadah')) {
		return { nama: 'Ibadah', jenis: 'ibadah' };
	}
	return { nama: kode, jenis: 'mapel' };
}

async function signatureFor(pegawaiId: number | null | undefined): Promise<string | null> {
	if (!pegawaiId) return null;
	try {
		return (await personSignatureDataUrl(pegawaiId)) ?? null;
	} catch {
		return null;
	}
}

export async function publishPortalToD1(sekolahId: number): Promise<PortalPublishResult> {
	const school =
		(await db.query.tableSekolah.findFirst({ where: eq(tableSekolah.id, sekolahId) })) ??
		(await db.query.tableSekolah.findFirst());
	if (!school) throw new Error('Data sekolah belum ada.');

	const activeSemester =
		(await db.query.tableSemester.findFirst({
			where: eq(tableSemester.isAktif, true)
		})) ??
		(await db.query.tableSemester.findFirst({ orderBy: (table, { desc }) => [desc(table.id)] }));
	if (!activeSemester) throw new Error('Semester aktif belum diatur.');

	const [tahunAjaranRows, addressRows, classRows, waliRows, allPegawai] = await Promise.all([
		db.query.tableTahunAjaran.findMany({ where: eq(tableTahunAjaran.sekolahId, sekolahId) }),
		db.query.tableAlamat.findMany(),
		db.query.tableKelas.findMany({
			where: and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, activeSemester.id))
		}),
		db.query.tableWaliMurid.findMany(),
		db.query.tablePegawai.findMany()
	]);

	const tahunAjaran = tahunAjaranRows.find((row) => row.id === activeSemester.tahunAjaranId);
	const addressMap = new Map(addressRows.map((row) => [row.id, row]));
	const pegawaiMap = new Map(allPegawai.map((row) => [row.id, row]));
	const waliMap = new Map(waliRows.map((row) => [row.id, row]));
	const classIds = classRows.map((row) => row.id);

	const [studentRows, subjectRows, accountRows] = await Promise.all([
		classIds.length
			? db.query.tableMurid.findMany({
					where: and(
						eq(tableMurid.sekolahId, sekolahId),
						eq(tableMurid.semesterId, activeSemester.id),
						inArray(tableMurid.kelasId, classIds)
					)
				})
			: Promise.resolve([]),
		classIds.length
			? db.query.tableMataPelajaran.findMany({
					where: inArray(tableMataPelajaran.kelasId, classIds)
				})
			: Promise.resolve([]),
		db.query.tablePortalOrangtua.findMany({ where: eq(tablePortalOrangtua.sekolahId, sekolahId) })
	]);

	const studentIds = studentRows.map((row) => row.id);
	const subjectIds = subjectRows.map((row) => row.id);
	const accountIds = accountRows.map((row) => row.id);

	const [gradeRows, attendanceRows, noteRows, scheduleRows, linkRows] = await Promise.all([
		studentIds.length && subjectIds.length
			? db.query.tableAsesmenSumatif.findMany({
					where: and(
						inArray(tableAsesmenSumatif.muridId, studentIds),
						inArray(tableAsesmenSumatif.mataPelajaranId, subjectIds),
						isNotNull(tableAsesmenSumatif.nilaiAkhir)
					)
				})
			: Promise.resolve([]),
		studentIds.length
			? db.query.tableKetidakhadiranRapor.findMany({
					where: and(
						eq(tableKetidakhadiranRapor.semesterId, activeSemester.id),
						inArray(tableKetidakhadiranRapor.muridId, studentIds)
					)
				})
			: Promise.resolve([]),
		studentIds.length
			? db.query.tableCatatanWaliKelas.findMany({
					where: inArray(tableCatatanWaliKelas.muridId, studentIds)
				})
			: Promise.resolve([]),
		classIds.length
			? db.query.tableJadwalPelajaran.findMany({
					where: inArray(tableJadwalPelajaran.kelasId, classIds)
				})
			: Promise.resolve([]),
		accountIds.length
			? db.query.tablePortalOrangtuaMurid.findMany({
					where: inArray(tablePortalOrangtuaMurid.orangtuaId, accountIds)
				})
			: Promise.resolve([])
	]);

	const schoolAddress = addressMap.get(school.alamatId);
	const head = pegawaiMap.get(school.kepalaSekolahId);
	const semesterRows = await db.query.tableSemester.findMany({
		where: inArray(
			tableSemester.tahunAjaranId,
			tahunAjaranRows.map((row) => row.id)
		)
	});

	const waliKelasIds = [
		...new Set(classRows.map((row) => row.waliKelasId).filter(Boolean))
	] as number[];
	const waliSignatureEntries = await Promise.all(
		waliKelasIds.map(async (id) => [id, await signatureFor(id)] as const)
	);
	const waliSignatureMap = new Map(waliSignatureEntries);

	const subjectByClass = new Map<number, typeof subjectRows>();
	for (const subject of subjectRows) {
		const list = subjectByClass.get(subject.kelasId) ?? [];
		list.push(subject);
		subjectByClass.set(subject.kelasId, list);
	}

	const mapelNameById = new Map(
		subjectRows.map((row) => [String(row.id), row.namaLokal || row.nama])
	);

	const config = portalConfig(await getD1Config(sekolahId));

	// Hapus data anak dulu, lalu data induk. Akun orang tua tidak dihapus agar
	// password yang sudah diganti di portal tetap tersimpan.
	await d1(config, 'delete from portal_orangtua_murid');
	await d1(config, 'delete from portal_nilai');
	await d1(config, 'delete from portal_presensi');
	await d1(config, 'delete from portal_catatan');
	await d1(config, 'delete from portal_jadwal');
	await d1(config, 'delete from portal_mapel');
	await d1(config, 'delete from portal_murid');
	await d1(config, 'delete from portal_kelas');
	await d1(config, 'delete from portal_semester');
	await d1(config, 'delete from portal_sekolah');
	await d1(config, 'update portal_orangtua set is_active = 0');

	await insertRows(
		config,
		'portal_sekolah',
		[
			'id',
			'nama',
			'npsn',
			'alamat',
			'telepon',
			'email',
			'website',
			'kepala_sekolah',
			'kepala_sekolah_nip',
			'kepala_sekolah_ttd',
			'logo_data_url',
			'updated_at'
		],
		[
			{
				id: school.id,
				nama: school.nama,
				npsn: school.npsn,
				alamat: composeAddress(schoolAddress),
				telepon: null,
				email: school.email,
				website: school.website,
				kepala_sekolah: head?.nama ?? null,
				kepala_sekolah_nip: head?.nip || null,
				kepala_sekolah_ttd: await signatureFor(school.kepalaSekolahId),
				logo_data_url: asDataUrl(school.logo, school.logoType),
				updated_at: new Date().toISOString()
			}
		]
	);

	await insertRows(
		config,
		'portal_semester',
		[
			'id',
			'nama',
			'tipe',
			'tahun_ajaran',
			'tanggal_mulai',
			'tanggal_selesai',
			'tanggal_bagi_rapor',
			'is_aktif'
		],
		semesterRows.map((row) => ({
			id: row.id,
			nama: row.nama,
			tipe: row.tipe,
			tahun_ajaran: tahunAjaranRows.find((t) => t.id === row.tahunAjaranId)?.nama ?? '',
			tanggal_mulai: row.tanggalMulai,
			tanggal_selesai: row.tanggalSelesai,
			tanggal_bagi_rapor: row.tanggalBagiRaport,
			is_aktif: row.isAktif ? 1 : 0
		}))
	);

	await insertRows(
		config,
		'portal_kelas',
		[
			'id',
			'nama',
			'fase',
			'semester_id',
			'tahun_ajaran',
			'wali_kelas',
			'wali_kelas_nip',
			'wali_kelas_ttd',
			'urutan'
		],
		classRows.map((row, index) => {
			const wali = row.waliKelasId ? pegawaiMap.get(row.waliKelasId) : null;
			return {
				id: row.id,
				nama: row.nama,
				fase: row.fase,
				semester_id: row.semesterId,
				tahun_ajaran: tahunAjaran?.nama ?? '',
				wali_kelas: wali?.nama ?? null,
				wali_kelas_nip: wali?.nip || null,
				wali_kelas_ttd: row.waliKelasId ? (waliSignatureMap.get(row.waliKelasId) ?? null) : null,
				urutan: index
			};
		})
	);

	await insertRows(
		config,
		'portal_murid',
		[
			'id',
			'nis',
			'nisn',
			'nama',
			'jenis_kelamin',
			'agama',
			'tempat_lahir',
			'tanggal_lahir',
			'alamat',
			'kelas_id',
			'semester_id',
			'foto_data_url',
			'wali_asuh_nama',
			'wali_asuh_nip',
			'ayah_nama',
			'ibu_nama',
			'wali_nama'
		],
		studentRows.map((row) => ({
			id: row.id,
			nis: row.nis,
			nisn: row.nisn,
			nama: row.nama,
			jenis_kelamin: row.jenisKelamin,
			agama: row.agama,
			tempat_lahir: row.tempatLahir,
			tanggal_lahir: row.tanggalLahir,
			alamat: composeAddress(addressMap.get(row.alamatId)),
			kelas_id: row.kelasId,
			semester_id: row.semesterId,
			foto_data_url: row.foto?.startsWith('data:') ? row.foto : null,
			wali_asuh_nama: row.waliAsuhNama,
			wali_asuh_nip: row.waliAsuhNip,
			ayah_nama: row.ayahId ? (waliMap.get(row.ayahId)?.nama ?? null) : null,
			ibu_nama: row.ibuId ? (waliMap.get(row.ibuId)?.nama ?? null) : null,
			wali_nama: row.waliId ? (waliMap.get(row.waliId)?.nama ?? null) : null
		}))
	);

	await insertRows(
		config,
		'portal_mapel',
		['id', 'kelas_id', 'nama', 'nama_lokal', 'kode', 'kkm', 'urutan', 'jenis'],
		subjectRows.map((row) => ({
			id: row.id,
			kelas_id: row.kelasId,
			nama: row.nama,
			nama_lokal: row.namaLokal,
			kode: row.kode,
			kkm: row.kkm,
			urutan: row.urutan,
			jenis: row.jenis
		}))
	);

	const gradePayload = gradeRows.map((row) => ({
		murid_id: row.muridId,
		mapel_id: row.mataPelajaranId,
		semester_id: activeSemester.id,
		nilai: row.nilaiAkhir,
		nilai_rts: row.nilaiAkhirRts,
		deskripsi: null
	}));
	await insertRows(
		config,
		'portal_nilai',
		['murid_id', 'mapel_id', 'semester_id', 'nilai', 'nilai_rts', 'deskripsi'],
		gradePayload
	);

	await insertRows(
		config,
		'portal_presensi',
		['murid_id', 'semester_id', 'sakit', 'izin', 'alfa', 'hari_efektif'],
		attendanceRows.map((row) => ({
			murid_id: row.muridId,
			semester_id: row.semesterId,
			sakit: row.sakit ?? 0,
			izin: row.izin ?? 0,
			alfa: row.alfa ?? 0,
			hari_efektif: null
		}))
	);

	await insertRows(
		config,
		'portal_catatan',
		['murid_id', 'semester_id', 'catatan'],
		noteRows
			.filter((row) => row.catatan?.trim())
			.map((row) => ({
				murid_id: row.muridId,
				semester_id: activeSemester.id,
				catatan: row.catatan?.trim() ?? ''
			}))
	);

	await insertRows(
		config,
		'portal_jadwal',
		['id', 'kelas_id', 'hari', 'jam_ke', 'kode', 'nama', 'jenis'],
		scheduleRows.map((row) => {
			const label = scheduleLabel(row.kodeKegiatan, mapelNameById);
			return {
				id: row.id,
				kelas_id: row.kelasId,
				hari: row.hari,
				jam_ke: row.jamKe,
				kode: row.kodeKegiatan,
				nama: label.nama,
				jenis: label.jenis
			};
		})
	);

	const activeAccounts = accountRows.filter((row) => row.isActive);
	const forceAccounts = activeAccounts.filter((row) => row.forcePasswordSync);
	const preserveAccounts = activeAccounts.filter((row) => !row.forcePasswordSync);

	const accountColumns = [
		'sekolah_id',
		'telepon',
		'nama',
		'password_hash',
		'password_salt',
		'must_change_password',
		'is_active',
		'created_at',
		'updated_at'
	];
	const accountRow = (row: (typeof activeAccounts)[number]) => ({
		sekolah_id: row.sekolahId,
		telepon: row.telepon,
		nama: row.nama,
		password_hash: row.passwordHash,
		password_salt: row.passwordSalt,
		must_change_password: row.mustChangePassword ? 1 : 0,
		is_active: 1,
		created_at: row.createdAt,
		updated_at: new Date().toISOString()
	});

	// Akun baru / hasil reset: timpa hash di portal.
	await upsertAccounts(config, accountColumns, forceAccounts.map(accountRow), true);
	// Akun lama: perbarui nama saja, jangan sentuh password yang mungkin sudah
	// diganti orang tua di portal.
	await upsertAccounts(config, accountColumns, preserveAccounts.map(accountRow), false);

	const accountIdResult = await d1(
		config,
		'select id, telepon from portal_orangtua where is_active = 1'
	);
	const portalAccountIds = new Map(
		(accountIdResult[0]?.results ?? []).map((row) => [String(row.telepon), Number(row.id)])
	);
	const localAccountPhone = new Map(accountRows.map((row) => [row.id, row.telepon]));
	const linkPayload: Row[] = [];
	for (const row of linkRows) {
		const phone = localAccountPhone.get(row.orangtuaId);
		const portalId = phone ? portalAccountIds.get(phone) : null;
		if (!portalId) continue;
		linkPayload.push({
			orangtua_id: portalId,
			murid_id: row.muridId,
			hubungan: row.hubungan
		});
	}

	await insertRows(
		config,
		'portal_orangtua_murid',
		['orangtua_id', 'murid_id', 'hubungan'],
		linkPayload
	);

	const now = new Date().toISOString();
	for (const [key, value] of [
		['last_sync_at', now],
		['last_publish_at', now],
		['source', 'e-Rapor'],
		['sekolah_id', String(sekolahId)]
	]) {
		await d1(
			config,
			`insert into portal_meta (key, value) values (?, ?)
			 on conflict(key) do update set value = excluded.value`,
			[key, value]
		);
	}

	await db
		.update(tablePortalOrangtua)
		.set({ lastPublishedAt: now, forcePasswordSync: false })
		.where(eq(tablePortalOrangtua.sekolahId, sekolahId));

	return {
		students: studentRows.length,
		parents: activeAccounts.length,
		links: linkPayload.length,
		grades: gradePayload.length,
		attendance: attendanceRows.length,
		schedules: scheduleRows.length,
		subjects: subjectRows.length
	};
}

async function upsertAccounts(
	config: D1Config,
	columns: string[],
	rows: Row[],
	forcePassword: boolean
): Promise<void> {
	if (rows.length === 0) return;
	const chunkSize = Math.max(1, Math.floor(100 / columns.length));
	for (let start = 0; start < rows.length; start += chunkSize) {
		const chunk = rows.slice(start, start + chunkSize);
		const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
		const params = chunk.flatMap((row) => columns.map((column) => row[column] ?? null));
		const update = forcePassword
			? `nama = excluded.nama, sekolah_id = excluded.sekolah_id,
			   password_hash = excluded.password_hash, password_salt = excluded.password_salt,
			   must_change_password = excluded.must_change_password, is_active = 1,
			   updated_at = excluded.updated_at`
			: `nama = excluded.nama, sekolah_id = excluded.sekolah_id,
			   is_active = 1, updated_at = excluded.updated_at`;
		await d1(
			config,
			`insert into portal_orangtua (${columns.join(', ')}) values ${placeholders}
			 on conflict(telepon) do update set ${update}`,
			params
		);
	}
}
