import { eq, getTableColumns } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import db from '$lib/server/db';
import {
	tableAlamat,
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableMuridMataPelajaran,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran,
	tableWaliMurid
} from '$lib/server/db/schema';

/**
 * Gabung (merge) paket master data dari Database Pusat ke instalasi lokal yang
 * sudah berisi data.
 *
 * Impor "ganti total" (lihat `importMasterData` di cloud-master.ts) hanya aman
 * untuk instalasi baru: ia mengosongkan tabel master lalu menulis ulang paket
 * apa adanya. Pada instalasi yang sudah berisi data, itu bisa menabrak batas
 * unik dan menghilangkan pekerjaan guru.
 *
 * Modul ini menggabungkan paket secara_additive:
 *   - baris yang belum ada di lokal → disisipkan,
 *   - baris yang sama → diperbarui pada kolom master saja,
 *   - baris yang hanya ada di lokal → tetap utuh (nilai, absensi, jadwal).
 *
 * Pencocokan memakai kunci alami, bukan id: id paket berasal dari komputer
 * operator sehingga nomornya berbeda dengan id lokal.
 */

export interface MergeCounts {
	inserted: number;
	updated: number;
	unchanged: number;
}

export interface MergeSummary {
	inserted: number;
	updated: number;
	unchanged: number;
	perTable: Record<string, MergeCounts>;
}

export interface MasterPayloadLike {
	app?: string;
	kind?: string;
	tables?: Record<string, Record<string, unknown>[]>;
}

/** Peta id paket (pusat) → id lokal, per tabel master. */
type IdMaps = Map<string, Map<number, number>>;

function toText(value: unknown): string {
	if (value == null) return '';
	return typeof value === 'string' ? value : String(value);
}

function toNumber(value: unknown): number | null {
	if (value == null || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

function sameValue(a: unknown, b: unknown): boolean {
	if (a == null && b == null) return true;
	if (a == null || b == null) return toText(a) === toText(b);
	if (typeof a === 'boolean' || typeof b === 'boolean') return toBool(a) === toBool(b);
	if (typeof a === 'number' || typeof b === 'number') {
		const na = Number(a);
		const nb = Number(b);
		if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
	}
	return toText(a) === toText(b);
}

function mapId(maps: IdMaps, table: string, value: unknown): number | null {
	const id = toNumber(value);
	if (id == null) return null;
	return maps.get(table)?.get(id) ?? null;
}

function idColumn(table: SQLiteTable) {
	return (table as unknown as { id: AnySQLiteColumn }).id;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface MergeTableOptions {
	name: string;
	table: SQLiteTable;
	rows: Record<string, unknown>[];
	existing: Record<string, unknown>[];
	/** Kunci alami baris — mencocokkan baris paket dengan baris lokal. */
	keyOf: (row: Record<string, unknown>) => string;
	/** Kolom yang ditulis saat baris baru disisipkan. */
	insertColumns: string[];
	/** Kolom yang ditulis saat baris lama diperbarui. */
	updateColumns?: string[];
	/** Pemetaan foreign key paket → id lokal, dijalankan sebelum key & kolom dihitung. */
	mapRow?: (row: Record<string, unknown>, maps: IdMaps) => Record<string, unknown>;
}

/**
 * Gabung satu tabel. Nama kolom yang tidak dikenal tabel diabaikan (divalidasi
 * terhadap skema Drizzle) supaya salah ketik tidak merusak impor.
 */
async function mergeTable(
	tx: DbExecutor,
	maps: IdMaps,
	summary: MergeSummary,
	options: MergeTableOptions
): Promise<void> {
	const { name, table, rows, existing } = options;
	const validColumns = new Set(Object.keys(getTableColumns(table)));
	const insertColumns = options.insertColumns.filter((column) => {
		if (validColumns.has(column)) return true;
		console.warn(`[cloud-merge] kolom "${column}" tidak dikenal pada tabel ${name} — diabaikan.`);
		return false;
	});
	const updateColumns = (options.updateColumns ?? options.insertColumns).filter((column) =>
		validColumns.has(column)
	);

	const index = new Map<string, Record<string, unknown>>();
	for (const row of existing) index.set(options.keyOf(row), row);

	const idMap = new Map<number, number>();
	maps.set(name, idMap);
	const counts: MergeCounts = { inserted: 0, updated: 0, unchanged: 0 };
	const nowIso = new Date().toISOString();

	for (const raw of rows) {
		const mapped = options.mapRow ? options.mapRow(raw, maps) : raw;
		const packageId = toNumber(raw.id);
		const key = options.keyOf(mapped);
		const local = index.get(key);

		if (local) {
			const localId = toNumber(local.id);
			if (packageId != null && localId != null) idMap.set(packageId, localId);

			const changed: Record<string, unknown> = {};
			for (const column of updateColumns) {
				const next = mapped[column];
				if (next === undefined) continue;
				if (!sameValue(local[column], next)) changed[column] = next;
			}
			if (Object.keys(changed).length === 0) {
				counts.unchanged += 1;
				continue;
			}
			changed.updatedAt = nowIso;
			await tx
				.update(table)
				.set(changed as never)
				.where(eq(idColumn(table), localId as number));
			counts.updated += 1;
			continue;
		}

		const values: Record<string, unknown> = {};
		for (const column of insertColumns) {
			if (column === 'id') continue;
			const value = mapped[column];
			if (value === undefined) continue;
			values[column] = value;
		}
		values.createdAt = values.createdAt ?? nowIso;
		values.updatedAt = nowIso;

		const inserted = await tx
			.insert(table)
			.values(values as never)
			.returning({ id: getTableColumns(table).id });
		const localId = toNumber(inserted?.[0]?.id);
		if (packageId != null && localId != null) idMap.set(packageId, localId);
		index.set(key, { id: localId });
		counts.inserted += 1;
	}

	summary.perTable[name] = counts;
	summary.inserted += counts.inserted;
	summary.updated += counts.updated;
	summary.unchanged += counts.unchanged;
}

/**
 * Gabung paket master ke database lokal.
 *
 * Urutan tabel mengikuti dependensi foreign key. Semua baris paket dipetakan
 * ke id lokal terlebih dahulu (alamat → wali murid → sekolah → pegawai →
 * tahun ajaran → semester → kelas → mapel → murid → akun → tabel penghubung).
 */
export async function mergeMasterData(payload: MasterPayloadLike): Promise<{
	summary: MergeSummary;
	sekolahId: number | null;
}> {
	if (payload?.app !== 'erapor-pmk' || payload?.kind !== 'master_data') {
		throw new Error('Paket dari pusat bukan paket master data e-Rapor PMK.');
	}

	const tables = payload.tables ?? {};
	const summary: MergeSummary = { inserted: 0, updated: 0, unchanged: 0, perTable: {} };
	const maps: IdMaps = new Map();

	await db.transaction(async (tx) => {
		await mergeTable(tx, maps, summary, {
			name: 'alamat',
			table: tableAlamat,
			rows: tables.alamat ?? [],
			existing: (await tx.select().from(tableAlamat)) as unknown as Record<string, unknown>[],
			keyOf: (row) =>
				[row.jalan, row.desa, row.kecamatan, row.kabupaten, row.kodePos].map(toText).join('|'),
			insertColumns: ['jalan', 'desa', 'kecamatan', 'kabupaten', 'provinsi', 'kodePos']
		});

		await mergeTable(tx, maps, summary, {
			name: 'wali_murid',
			table: tableWaliMurid,
			rows: tables.wali_murid ?? [],
			existing: (await tx.select().from(tableWaliMurid)) as unknown as Record<string, unknown>[],
			keyOf: (row) => [row.nama, row.pekerjaan, row.kontak].map(toText).join('|'),
			insertColumns: ['nama', 'pekerjaan', 'kontak', 'alamat']
		});

		await mergeTable(tx, maps, summary, {
			name: 'sekolah',
			table: tableSekolah,
			rows: tables.sekolah ?? [],
			existing: (await tx.select().from(tableSekolah)) as unknown as Record<string, unknown>[],
			keyOf: (row) => toText(row.npsn),
			mapRow: (row, idMaps) => ({
				...row,
				alamatId: mapId(idMaps, 'alamat', row.alamatId),
				// Kepala sekolah belum bisa dipetakan (pegawai diproses setelah sekolah).
				kepalaSekolahId: null
			}),
			insertColumns: [
				'jenjangPendidikan',
				'jenjangVariant',
				'nama',
				'npsn',
				'alamatId',
				'logo',
				'logoType',
				'logoDinas',
				'logoDinasType',
				'website',
				'email',
				'kepalaSekolahId'
			],
			// Logo & kepala sekolah tidak ditulis pada baris lama: logo lokal bisa sudah
			// disesuaikan sekolah, kepala sekolah disambungkan setelah pegawai diproses.
			updateColumns: [
				'jenjangPendidikan',
				'jenjangVariant',
				'nama',
				'npsn',
				'email',
				'website',
				'alamatId'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'pegawai',
			table: tablePegawai,
			rows: tables.pegawai ?? [],
			existing: (await tx.select().from(tablePegawai)) as unknown as Record<string, unknown>[],
			keyOf: (row) => {
				const nip = toText(row.nip);
				return nip ? `nip:${nip}` : `nama:${toText(row.nama)}`;
			},
			mapRow: (row, idMaps) => ({ ...row, sekolahId: mapId(idMaps, 'sekolah', row.sekolahId) }),
			insertColumns: ['nama', 'nip', 'nik', 'sekolahId', 'dapodikPtkId', 'nuptk'],
			updateColumns: ['nama', 'nik', 'sekolahId', 'dapodikPtkId', 'nuptk']
		});

		// Kepala sekolah sekolah sekarang bisa dipetakan ke pegawai lokal.
		const packageSekolah = (tables.sekolah?.[0] ?? null) as Record<string, unknown> | null;
		const localSekolahId = mapId(maps, 'sekolah', packageSekolah?.id);
		const localKepalaId = mapId(maps, 'pegawai', packageSekolah?.kepalaSekolahId);
		if (localSekolahId != null && localKepalaId != null) {
			await tx
				.update(tableSekolah)
				.set({ kepalaSekolahId: localKepalaId, updatedAt: new Date().toISOString() })
				.where(eq(tableSekolah.id, localSekolahId));
		}

		await mergeTable(tx, maps, summary, {
			name: 'tahun_ajaran',
			table: tableTahunAjaran,
			rows: tables.tahun_ajaran ?? [],
			existing: (await tx.select().from(tableTahunAjaran)) as unknown as Record<string, unknown>[],
			keyOf: (row) => `${toText(row.sekolahId)}|${toText(row.nama)}`,
			mapRow: (row, idMaps) => ({ ...row, sekolahId: mapId(idMaps, 'sekolah', row.sekolahId) }),
			insertColumns: [
				'sekolahId',
				'nama',
				'tanggalMulai',
				'tanggalSelesai',
				'isAktif',
				'dapodikTahunAjaranId'
			],
			updateColumns: ['tanggalMulai', 'tanggalSelesai', 'isAktif', 'dapodikTahunAjaranId']
		});

		await mergeTable(tx, maps, summary, {
			name: 'semester',
			table: tableSemester,
			rows: tables.semester ?? [],
			existing: (await tx.select().from(tableSemester)) as unknown as Record<string, unknown>[],
			keyOf: (row) => `${toText(row.tahunAjaranId)}|${toText(row.tipe)}`,
			mapRow: (row, idMaps) => ({
				...row,
				tahunAjaranId: mapId(idMaps, 'tahun_ajaran', row.tahunAjaranId)
			}),
			insertColumns: [
				'tahunAjaranId',
				'nama',
				'tipe',
				'tanggalMulai',
				'tanggalSelesai',
				'tanggalBagiRaport',
				'tanggalMasuk',
				'isAktif',
				'dapodikSemesterId'
			],
			updateColumns: [
				'nama',
				'tanggalMulai',
				'tanggalSelesai',
				'tanggalBagiRaport',
				'tanggalMasuk',
				'isAktif',
				'dapodikSemesterId'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'kelas',
			table: tableKelas,
			rows: tables.kelas ?? [],
			existing: (await tx.select().from(tableKelas)) as unknown as Record<string, unknown>[],
			keyOf: (row) => `${toText(row.sekolahId)}|${toText(row.semesterId)}|${toText(row.nama)}`,
			mapRow: (row, idMaps) => ({
				...row,
				sekolahId: mapId(idMaps, 'sekolah', row.sekolahId),
				semesterId: mapId(idMaps, 'semester', row.semesterId),
				waliKelasId: mapId(idMaps, 'pegawai', row.waliKelasId),
				waliAsuhId: mapId(idMaps, 'pegawai', row.waliAsuhId)
			}),
			insertColumns: [
				'sekolahId',
				'tahunAjaranId',
				'semesterId',
				'nama',
				'fase',
				'waliKelasId',
				'waliAsuhId',
				'raporKriteriaCukup',
				'raporKriteriaBaik',
				'dapodikRombonganBelajarId'
			],
			updateColumns: [
				'fase',
				'waliKelasId',
				'waliAsuhId',
				'raporKriteriaCukup',
				'raporKriteriaBaik',
				'dapodikRombonganBelajarId'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'mata_pelajaran',
			table: tableMataPelajaran,
			rows: tables.mata_pelajaran ?? [],
			existing: (await tx.select().from(tableMataPelajaran)) as unknown as Record<
				string,
				unknown
			>[],
			keyOf: (row) => `${toText(row.kelasId)}|${toText(row.nama)}`,
			mapRow: (row, idMaps) => ({
				...row,
				kelasId: mapId(idMaps, 'kelas', row.kelasId),
				pengampuId: mapId(idMaps, 'pegawai', row.pengampuId)
			}),
			insertColumns: [
				'kelasId',
				'nama',
				'namaLokal',
				'kode',
				'kkm',
				'jenis',
				'pengampuId',
				'urutan',
				'dapodikPembelajaranId',
				'dapodikMataPelajaranId',
				'dapodikIndukPembelajaranId'
			],
			updateColumns: [
				'namaLokal',
				'kode',
				'kkm',
				'jenis',
				'pengampuId',
				'urutan',
				'dapodikPembelajaranId',
				'dapodikMataPelajaranId',
				'dapodikIndukPembelajaranId'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'murid',
			table: tableMurid,
			rows: tables.murid ?? [],
			existing: (await tx.select().from(tableMurid)) as unknown as Record<string, unknown>[],
			keyOf: (row) => `${toText(row.sekolahId)}|${toText(row.semesterId)}|${toText(row.nis)}`,
			mapRow: (row, idMaps) => ({
				...row,
				sekolahId: mapId(idMaps, 'sekolah', row.sekolahId),
				semesterId: mapId(idMaps, 'semester', row.semesterId),
				kelasId: mapId(idMaps, 'kelas', row.kelasId),
				alamatId: mapId(idMaps, 'alamat', row.alamatId),
				ibuId: mapId(idMaps, 'wali_murid', row.ibuId),
				ayahId: mapId(idMaps, 'wali_murid', row.ayahId),
				waliId: mapId(idMaps, 'wali_murid', row.waliId)
			}),
			insertColumns: [
				'nis',
				'nisn',
				'sekolahId',
				'semesterId',
				'kelasId',
				'nama',
				'tempatLahir',
				'tanggalLahir',
				'jenisKelamin',
				'agama',
				'pendidikanSebelumnya',
				'tanggalMasuk',
				'alamatId',
				'ibuId',
				'ayahId',
				'waliId',
				'waliAsuhNama',
				'waliAsuhNip',
				'dapodikPesertaDidikId',
				'dapodikAnggotaRombelId',
				'nik',
				'anakKe'
			],
			// Foto & NIS tidak ditulis: keduanya data lokal yang sudah jadi kunci.
			updateColumns: [
				'nisn',
				'kelasId',
				'nama',
				'tempatLahir',
				'tanggalLahir',
				'jenisKelamin',
				'agama',
				'pendidikanSebelumnya',
				'tanggalMasuk',
				'alamatId',
				'ibuId',
				'ayahId',
				'waliId',
				'waliAsuhNama',
				'waliAsuhNip',
				'dapodikPesertaDidikId',
				'dapodikAnggotaRombelId',
				'nik',
				'anakKe'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'auth_user',
			table: tableAuthUser,
			rows: tables.auth_user ?? [],
			existing: (await tx.select().from(tableAuthUser)) as unknown as Record<string, unknown>[],
			keyOf: (row) => toText(row.usernameNormalized) || toText(row.username),
			mapRow: (row, idMaps) => ({
				...row,
				sekolahId: mapId(idMaps, 'sekolah', row.sekolahId),
				pegawaiId: mapId(idMaps, 'pegawai', row.pegawaiId),
				kelasId: mapId(idMaps, 'kelas', row.kelasId),
				mataPelajaranId: mapId(idMaps, 'mata_pelajaran', row.mataPelajaranId)
			}),
			insertColumns: [
				'username',
				'usernameNormalized',
				'passwordHash',
				'passwordSalt',
				'mustChangePassword',
				'type',
				'permissions',
				'sekolahId',
				'pegawaiId',
				'kelasId',
				'mataPelajaranId',
				'namaLengkap',
				'tempatLahir',
				'tanggalLahir',
				'jenisKelamin',
				'ijazah',
				'tahunIjazah',
				'statusKepegawaian',
				'golongan',
				'jabatan',
				'pangkat',
				'tanggalPangkat',
				'tanggalDiangkat',
				'tanggalBekerja',
				'tanggalGajiBerkala'
			],
			// Kata sandi dan izin tidak ditimpa: pengaturan per akun di sekolah bisa
			// saja sudah customized admin.
			updateColumns: [
				'type',
				'sekolahId',
				'pegawaiId',
				'kelasId',
				'mataPelajaranId',
				'namaLengkap',
				'tempatLahir',
				'tanggalLahir',
				'jenisKelamin',
				'ijazah',
				'tahunIjazah',
				'statusKepegawaian',
				'golongan',
				'jabatan',
				'pangkat',
				'tanggalPangkat',
				'tanggalDiangkat',
				'tanggalBekerja',
				'tanggalGajiBerkala'
			]
		});

		await mergeTable(tx, maps, summary, {
			name: 'auth_user_mata_pelajaran',
			table: tableAuthUserMataPelajaran,
			rows: tables.auth_user_mata_pelajaran ?? [],
			existing: (await tx.select().from(tableAuthUserMataPelajaran)) as unknown as Record<
				string,
				unknown
			>[],
			keyOf: (row) => `${toText(row.authUserId)}|${toText(row.mataPelajaranId)}`,
			mapRow: (row, idMaps) => ({
				...row,
				authUserId: mapId(idMaps, 'auth_user', row.authUserId),
				mataPelajaranId: mapId(idMaps, 'mata_pelajaran', row.mataPelajaranId)
			}),
			insertColumns: ['authUserId', 'mataPelajaranId'],
			updateColumns: []
		});

		await mergeTable(tx, maps, summary, {
			name: 'auth_user_kelas',
			table: tableAuthUserKelas,
			rows: tables.auth_user_kelas ?? [],
			existing: (await tx.select().from(tableAuthUserKelas)) as unknown as Record<
				string,
				unknown
			>[],
			keyOf: (row) => `${toText(row.authUserId)}|${toText(row.kelasId)}`,
			mapRow: (row, idMaps) => ({
				...row,
				authUserId: mapId(idMaps, 'auth_user', row.authUserId),
				kelasId: mapId(idMaps, 'kelas', row.kelasId)
			}),
			insertColumns: ['authUserId', 'kelasId'],
			updateColumns: []
		});

		await mergeTable(tx, maps, summary, {
			name: 'murid_mata_pelajaran',
			table: tableMuridMataPelajaran,
			rows: tables.murid_mata_pelajaran ?? [],
			existing: (await tx.select().from(tableMuridMataPelajaran)) as unknown as Record<
				string,
				unknown
			>[],
			keyOf: (row) => `${toText(row.muridId)}|${toText(row.mataPelajaranId)}`,
			mapRow: (row, idMaps) => ({
				...row,
				muridId: mapId(idMaps, 'murid', row.muridId),
				mataPelajaranId: mapId(idMaps, 'mata_pelajaran', row.mataPelajaranId)
			}),
			insertColumns: ['muridId', 'mataPelajaranId', 'nilaiKosong'],
			updateColumns: []
		});
	});

	const sekolahRows = await db.select({ id: tableSekolah.id }).from(tableSekolah);
	return { summary, sekolahId: sekolahRows[0]?.id ?? null };
}
