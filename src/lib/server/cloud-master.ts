import { createHash } from 'node:crypto';
import { eq, getTableColumns, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import db from '$lib/server/db';
import {
	tableAbsensi,
	tableAlamat,
	tableAsesmenSumatif,
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableCatatanWaliKelas,
	tableCloudSyncLogs,
	tableCloudSyncSettings,
	tableJadwalPelajaran,
	tableJurnalMengajar,
	tableKehadiranMurid,
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
import { executeD1Query, getD1Config } from '$lib/server/cloudflare-d1';
import { defaultAdminUsernameNormalized, ensureDefaultAdmin } from '$lib/server/auth';

/**
 * Sinkronisasi master data (data induk) antara instalasi lokal dan Database Pusat.
 *
 * Berbeda dari `cloudflare-d1.ts` yang mengirim nilai/administrasi guru, modul ini
 * mengurus data yang dibutuhkan supaya aplikasi di komputer baru bisa dipakai:
 * identitas sekolah, pegawai, siswa, kelas, mapel, sampai akun pengguna.
 *
 * Akun disalin apa adanya sebagai `password_hash` + `password_salt` (skema scrypt
 * di `src/lib/server/auth.ts`) — kata sandi polos tidak pernah ikut dikirim.
 *
 * Urutan tabel mengikuti dependensi: alamat dan wali murid lebih dulu karena
 * `sekolah.alamat_id` dan `murid.alamat_id` mengarah ke sana.
 */
export const MASTER_TABLES: readonly [string, SQLiteTable][] = [
	['alamat', tableAlamat],
	['wali_murid', tableWaliMurid],
	['pegawai', tablePegawai],
	['sekolah', tableSekolah],
	['tahun_ajaran', tableTahunAjaran],
	['semester', tableSemester],
	['kelas', tableKelas],
	['mata_pelajaran', tableMataPelajaran],
	['murid', tableMurid],
	['auth_user', tableAuthUser],
	['auth_user_mata_pelajaran', tableAuthUserMataPelajaran],
	['auth_user_kelas', tableAuthUserKelas],
	['murid_mata_pelajaran', tableMuridMataPelajaran]
];

/** Tabel yang dihitung ulang untuk menampilkan rekap master data lokal. */
const SUMMARY_TABLES: readonly [string, SQLiteTable][] = [
	['sekolah', tableSekolah],
	['pegawai', tablePegawai],
	['kelas', tableKelas],
	['mata_pelajaran', tableMataPelajaran],
	['murid', tableMurid],
	['auth_user', tableAuthUser]
];

const BLOB_MARKER = '__blob';
const INSERT_CHUNK_SIZE = 200;

/** Koneksi biasa atau transaksi — keduanya bisa dipakai untuk menghapus/menyisipkan baris. */
type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Tabel yang menandakan aplikasi sudah pernah dipakai. Selama semuanya kosong, isi
 * database masih bisa diganti paket master dari pusat tanpa kehilangan pekerjaan guru.
 */
const ACTIVITY_TABLES: readonly SQLiteTable[] = [
	tableAbsensi,
	tableKehadiranMurid,
	tableJadwalPelajaran,
	tableJurnalMengajar,
	tableAsesmenSumatif,
	tableCatatanWaliKelas
];

export interface MasterPayload {
	app: 'erapor-pmk';
	kind: 'master_data';
	schema: 1;
	exported_at: string;
	tables: Record<string, Record<string, unknown>[]>;
}

export interface MasterCounts {
	[key: string]: number;
}

function toBase64(bytes: Uint8Array) {
	return Buffer.from(bytes).toString('base64');
}

/** BLOB tidak bisa lewat JSON apa adanya; dibungkus penanda agar bisa dipulihkan. */
function serializeValue(value: unknown): unknown {
	if (value instanceof Uint8Array) return { [BLOB_MARKER]: toBase64(value) };
	return value;
}

function deserializeValue(value: unknown): unknown {
	if (value && typeof value === 'object' && BLOB_MARKER in (value as Record<string, unknown>)) {
		const encoded = (value as Record<string, unknown>)[BLOB_MARKER];
		if (typeof encoded === 'string') return new Uint8Array(Buffer.from(encoded, 'base64'));
	}
	return value;
}

function columnKeys(table: SQLiteTable) {
	return new Set(Object.keys(getTableColumns(table)));
}

function normalizeRow(row: Record<string, unknown>, allowed: Set<string>) {
	const out: Record<string, unknown> = {};
	for (const [key, raw] of Object.entries(row)) {
		// Kunci asing (dari versi skema lain) dibuang supaya tidak jadi kolom tak dikenal.
		if (!allowed.has(key)) continue;
		out[key] = deserializeValue(raw);
	}
	return out;
}

export function checksumOf(payload: unknown) {
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Kumpulkan seluruh baris tabel master untuk dikirim ke pusat. */
export async function exportMasterData(): Promise<MasterPayload> {
	const tables: Record<string, Record<string, unknown>[]> = {};

	for (const [name, table] of MASTER_TABLES) {
		const rows = (await db.select().from(table)) as unknown as Record<string, unknown>[];
		tables[name] = rows.map((row) => {
			const serialized: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(row)) serialized[key] = serializeValue(value);
			return serialized;
		});
	}

	return {
		app: 'erapor-pmk',
		kind: 'master_data',
		schema: 1,
		exported_at: new Date().toISOString(),
		tables
	};
}

export function countPayloadRows(payload: MasterPayload): MasterCounts {
	const counts: MasterCounts = {};
	for (const [name] of MASTER_TABLES) counts[name] = payload.tables[name]?.length ?? 0;
	return counts;
}

/** Rekap jumlah baris tabel master yang ada di lokal sekarang. */
export async function countLocalMaster(): Promise<MasterCounts> {
	const counts: MasterCounts = {};
	for (const [name, table] of SUMMARY_TABLES) {
		const rows = await db.select({ value: sql<number>`count(*)` }).from(table);
		counts[name] = Number(rows[0]?.value ?? 0);
	}
	return counts;
}

/**
 * Instalasi dianggap masih kosong kalau belum ada siswa, belum ada akun buatan sendiri,
 * dan belum ada aktivitas guru.
 *
 * Catatan: `ensureSmkPratamaMulya` selalu menanam profil sekolah beserta tahun ajaran,
 * semester, dan satu kelas contoh, jadi kondisi "kosong" tidak bisa diukur dari tabel
 * sekolah — baris contoh itu memang diganti paket dari pusat.
 */
export async function isLocalMasterEmpty(): Promise<boolean> {
	const counts = await countLocalMaster();
	const accounts = await countNonDefaultAccounts();
	const activity = await countLocalActivity();
	return counts.murid === 0 && accounts === 0 && activity === 0;
}

/** Total baris di tabel aktivitas — dipakai hanya sebagai penanda instalasi belum dipakai. */
export async function countLocalActivity(): Promise<number> {
	const results = await Promise.all(
		ACTIVITY_TABLES.map((table) => db.select({ value: sql<number>`count(*)` }).from(table))
	);
	return results.reduce((sum, rows) => sum + Number(rows[0]?.value ?? 0), 0);
}

/**
 * Akun yang dibuat sendiri oleh operator.
 *
 * Dua akun yang muncul otomatis tidak dihitung: akun bawaan `Admin` dan akun
 * `kepala_sekolah` yang dibentuk `ensureKepalaSekolahAccounts` dari pegawai kepala
 * sekolah sekolah tersebut (`pegawai_id` = `sekolah.kepala_sekolah_id`). Keduanya
 * lahir sendiri di instalasi baru, sedangkan akun lain berarti sudah ada pekerjaan
 * yang tidak boleh ditimpa paket master dari pusat.
 */
export async function countNonDefaultAccounts(): Promise<number> {
	const [accounts, sekolahRows] = await Promise.all([
		db
			.select({
				id: tableAuthUser.id,
				usernameNormalized: tableAuthUser.usernameNormalized,
				type: tableAuthUser.type,
				pegawaiId: tableAuthUser.pegawaiId,
				sekolahId: tableAuthUser.sekolahId
			})
			.from(tableAuthUser),
		db
			.select({ id: tableSekolah.id, kepalaSekolahId: tableSekolah.kepalaSekolahId })
			.from(tableSekolah)
	]);

	const autoKepala = new Set(
		sekolahRows.map((row) => `${row.id}:${row.kepalaSekolahId ?? 'null'}`)
	);

	return accounts.filter((row) => {
		if (row.usernameNormalized === defaultAdminUsernameNormalized) return false;
		if (
			row.type === 'kepala_sekolah' &&
			row.pegawaiId !== null &&
			autoKepala.has(`${row.sekolahId ?? 'null'}:${row.pegawaiId}`)
		) {
			return false;
		}
		return true;
	}).length;
}

/**
 * Tulis paket master ke Database Pusat: satu baris `packages` (isi data) plus satu
 * baris `publish_versions` scope `master_data` sebagai penunjuk versi terakhir.
 */
export async function pushMasterDataToCloud(sekolahId: number, userId: number | null) {
	const config = await getD1Config(sekolahId);
	if (!config.accountId || !config.apiToken) {
		return {
			success: false,
			message:
				'Kredensial Database Pusat belum siap, jadi master data tidak dikirim ke Database Pusat.'
		};
	}

	const payload = await exportMasterData();
	const counts = countPayloadRows(payload);
	const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);
	const checksum = checksumOf(payload);
	const stamp = new Date().toISOString();
	const packageId = `master-${sekolahId}-${Date.now()}`;

	if (totalRecords === 0) {
		return {
			success: false,
			message: 'Belum ada data induk di komputer ini, jadi tidak ada yang bisa dikirim ke pusat.'
		};
	}

	const packageInsert = await executeD1Query(
		config,
		`INSERT INTO packages (id, school_id, package_type, file_name, version, checksum, payload_json, status, summary_json, created_by, created_at)
		 VALUES (?, ?, 'master_data', 'master.erdata', '1.0', ?, ?, 'PUBLISHED', ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json, checksum=excluded.checksum, summary_json=excluded.summary_json, status='PUBLISHED'`,
		[
			packageId,
			String(sekolahId),
			checksum,
			JSON.stringify(payload),
			JSON.stringify({ counts, total_records: totalRecords }),
			userId ? String(userId) : null,
			stamp
		]
	);

	if (!packageInsert.success) {
		return {
			success: false,
			message: packageInsert.error ?? 'Gagal mengirim master data ke Database Pusat.'
		};
	}

	const versionInsert = await executeD1Query(
		config,
		`INSERT INTO publish_versions (id, school_id, version_code, scope, checksum, metadata_json, total_records, status, published_by, published_at)
		 VALUES (?, ?, ?, 'master_data', ?, ?, ?, 'published', ?, ?)`,
		[
			`pv-master-${Date.now()}`,
			String(sekolahId),
			stamp.replace(/[-:TZ.]/g, '').slice(0, 14),
			checksum,
			JSON.stringify({ package_id: packageId, counts, total_records: totalRecords }),
			totalRecords,
			userId ? String(userId) : null,
			stamp
		]
	);

	if (!versionInsert.success) {
		return {
			success: false,
			message: versionInsert.error ?? 'Paket master tersimpan, tetapi penunjuk versinya gagal.'
		};
	}

	return {
		success: true,
		message: `Master data terkirim ke Database Pusat (${totalRecords} baris).`,
		totalRecords,
		counts,
		checksum
	};
}

/** Sisipkan baris ke tabel lokal lewat koneksi/transaksi yang diberikan. */
async function insertRows(
	executor: DbExecutor,
	table: SQLiteTable,
	rows: Record<string, unknown>[]
) {
	if (rows.length === 0) return;
	const allowed = columnKeys(table);
	for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
		const chunk = rows
			.slice(index, index + INSERT_CHUNK_SIZE)
			.map((row) => normalizeRow(row, allowed));
		// Nilai sudah dipetakan ke nama kolom oleh schema lokal; Drizzle yang menyusun SQL.
		await executor.insert(table).values(chunk as never);
	}
}

/**
 * Impor paket master ke database lokal. Pemanggil wajib memastikan database masih
 * kosong (lihat `isLocalMasterEmpty`) supaya tidak ada baris pengguna yang tertimpa.
 */
export async function importMasterData(payload: MasterPayload) {
	if (payload?.app !== 'erapor-pmk' || payload?.kind !== 'master_data') {
		throw new Error('Paket dari pusat bukan paket master data e-Rapor PMK.');
	}

	// Pemanggil sudah memastikan instalasi masih kosong (`isLocalMasterEmpty`). Baris yang
	// ada sekarang hanyalah profil contoh dari `ensureSmkPratamaMulya` plus akun bawaan
	// Admin, dan baris contoh itu pasti bentrok dengan batas unik data asli (npsn sekolah,
	// nama tahun ajaran). Jadi tabel master dibersihkan dulu, baru diisi paket pusat.
	//
	// Semuanya dalam satu transaksi dengan kunci asing ditunda: relasi sekolah ↔ pegawai
	// saling menunjuk, jadi urutan hapus murni "anak dulu" tidak mungkin. Pemeriksaan FK
	// baru dijalankan saat commit, ketika seluruh paket sudah terpasang.
	const imported: MasterCounts = {};
	await db.transaction(async (tx) => {
		await tx.run(sql`PRAGMA defer_foreign_keys = ON`);
		for (const [, table] of MASTER_TABLES) {
			await tx.delete(table);
		}
		for (const [name, table] of MASTER_TABLES) {
			const rows = payload.tables?.[name] ?? [];
			await insertRows(tx, table, rows);
			imported[name] = rows.length;
		}
	});

	// Kalau paket pusat ternyata tidak memuat akun administrator, instalasi ini tidak boleh
	// terkunci tanpa jalan masuk. Akun bawaan dibuat ulang sebagai pintu darurat.
	const admins = await db
		.select({ id: tableAuthUser.id })
		.from(tableAuthUser)
		.where(eq(tableAuthUser.type, 'admin'));
	if (admins.length === 0) {
		await ensureDefaultAdmin();
	}

	const sekolahRows = await db.select({ id: tableSekolah.id }).from(tableSekolah);
	return { imported, sekolahId: sekolahRows[0]?.id ?? null };
}

export interface PullMasterResult {
	success: boolean;
	message: string;
	counts: MasterCounts;
	totalRecords: number;
}

/**
 * Sinkronisasi master dari tombol di /sinkronisasi. Hanya dijalankan saat data induk
 * lokal masih kosong: impor menulis baris apa adanya, jadi menjalankannya di database
 * yang sudah terisi akan menabrak batas unik (username, NIS, nama kelas per semester).
 */
export async function syncMasterFromCloud(
	sekolahId: number,
	userId: number | null
): Promise<PullMasterResult> {
	if (!(await isLocalMasterEmpty())) {
		return {
			success: false,
			message:
				'Database lokal sudah berisi data induk, jadi sinkronisasi master tidak dijalankan. Sinkronisasi master penuh hanya untuk instalasi baru (lihat halaman penyiapan).',
			counts: {},
			totalRecords: 0
		};
	}

	return pullMasterDataFromCloud(sekolahId, userId);
}

/**
 * PULL master: baca penunjuk versi terakhir di `publish_versions`, ambil isinya dari
 * `packages`, lalu tulis ke database lokal.
 *
 * Penunjuk diseleksi per `school_id` bila identitas sekolahnya sudah diketahui
 * (`sekolahId > 0`, mis. PULL dari /sinkronisasi setelah login). Pada halaman /siapkan
 * database lokal masih kosong sehingga belum ada identitas sekolah (`sekolahId = 0`);
 * penunjuk tanpa filter hanya aman di pengeclosean internal satu sekolah.
 */
export async function pullMasterDataFromCloud(
	sekolahId: number,
	userId: number | null
): Promise<PullMasterResult> {
	const config = await getD1Config(sekolahId);

	if (!config?.accountId || !config.apiToken) {
		return {
			success: false,
			message: config?.wranglerTokenExpired
				? 'Sesi wrangler di komputer ini sudah kedaluwarsa, jadi data tidak ditarik dari Database Pusat.'
				: 'Kredensial Database Pusat belum siap, jadi data tidak disinkronkan dari Database Pusat.',
			counts: {},
			totalRecords: 0
		};
	}

	const schoolFilter = sekolahId > 0 ? `AND school_id = ?` : '';
	const pointer = await executeD1Query(
		config,
		`SELECT metadata_json, checksum FROM publish_versions WHERE scope = 'master_data' ${schoolFilter} ORDER BY published_at DESC LIMIT 1`,
		sekolahId > 0 ? [String(sekolahId)] : []
	);

	if (!pointer.success) {
		return {
			success: false,
			message: pointer.error ?? 'Gagal membaca penunjuk versi master dari Database Pusat.',
			counts: {},
			totalRecords: 0
		};
	}

	const pointerRows = extractRows(pointer.result);
	if (pointerRows.length === 0) {
		return {
			success: false,
			message:
				'Database Pusat belum punya paket master data. Kirim dulu dari komputer sekolah lewat menu Sinkronisasi.',
			counts: {},
			totalRecords: 0
		};
	}

	const metadata = parseJsonObject(pointerRows[0]?.metadata_json);
	const pointerChecksum = toNonEmptyString(pointerRows[0]?.checksum);
	const packageId = typeof metadata?.package_id === 'string' ? metadata.package_id : '';
	if (!packageId) {
		return {
			success: false,
			message: 'Penunjuk versi master di pusat tidak memuat ID paket.',
			counts: {},
			totalRecords: 0
		};
	}

	const packageRes = await executeD1Query(
		config,
		`SELECT payload_json, checksum FROM packages WHERE id = ? LIMIT 1`,
		[packageId]
	);

	if (!packageRes.success) {
		return {
			success: false,
			message: packageRes.error ?? 'Gagal mengambil isi paket master dari Database Pusat.',
			counts: {},
			totalRecords: 0
		};
	}

	const packageRows = extractRows(packageRes.result);
	const rawPayload = packageRows[0]?.payload_json;
	if (typeof rawPayload !== 'string') {
		return {
			success: false,
			message: 'Paket master di pusat tidak ditemukan atau isinya kosong.',
			counts: {},
			totalRecords: 0
		};
	}

	const packageChecksum = toNonEmptyString(packageRows[0]?.checksum);
	if (pointerChecksum && packageChecksum && pointerChecksum !== packageChecksum) {
		return {
			success: false,
			message:
				'Penunjuk versi master tidak cocok dengan paketnya di Database Pusat. Kirim ulang master data dari komputer sekolah.',
			counts: {},
			totalRecords: 0
		};
	}

	const payload = parseJsonObject(rawPayload) as MasterPayload | null;
	if (!payload) {
		return {
			success: false,
			message: 'Isi paket master di pusat tidak bisa dibaca.',
			counts: {},
			totalRecords: 0
		};
	}

	// Integritas paket: isi yang turun di Wajib identik dengan checksum saat dikirim,
	// supaya paket yang rusak / diganti parameternya tidak dipasang ke database lokal.
	if (packageChecksum && checksumOf(payload) !== packageChecksum) {
		return {
			success: false,
			message:
				'Checksum paket master tidak cocok. Isi paket di Database Pusat berubah sejak dikirim; kirim ulang master data dari komputer sekolah.',
			counts: {},
			totalRecords: 0
		};
	}

	const { imported, sekolahId: localSekolahId } = await importMasterData(payload);
	const totalRecords = Object.values(imported).reduce((sum, value) => sum + value, 0);
	const nowIso = new Date().toISOString();
	const targetSekolahId = localSekolahId ?? sekolahId;

	// Identitas sekolah dari paket disebut ke operator supaya salah sasaran terlihat
	// langsung di layar, terutama pada /siapkan di mana belum ada pemeriksaan school_id.
	const importedSekolah = (payload.tables?.sekolah?.[0] ?? null) as Record<string, unknown> | null;
	const namaSekolah = toNonEmptyString(importedSekolah?.nama);

	await db.insert(tableCloudSyncLogs).values({
		sekolahId: targetSekolahId,
		userId,
		action: 'PULL',
		status: 'SUCCESS',
		totalRecords,
		summary: JSON.stringify({ kind: 'master_data', counts: imported }),
		createdAt: nowIso
	});

	const stored = await db.query.tableCloudSyncSettings.findFirst({
		where: eq(tableCloudSyncSettings.sekolahId, targetSekolahId)
	});
	if (stored) {
		await db
			.update(tableCloudSyncSettings)
			.set({ lastPulledAt: nowIso, updatedAt: nowIso })
			.where(eq(tableCloudSyncSettings.id, stored.id));
	} else {
		await db.insert(tableCloudSyncSettings).values({
			sekolahId: targetSekolahId,
			lastPulledAt: nowIso,
			createdAt: nowIso
		});
	}

	return {
		success: true,
		message: `Master data${namaSekolah ? ` sekolah ${namaSekolah}` : ''} dari pusat berhasil dipasang (${totalRecords} baris).`,
		counts: imported,
		totalRecords
	};
}

/** D1 membalas `result` sebagai array hasil per-statement; ambil barisnya. */
function extractRows(result: unknown): Record<string, unknown>[] {
	if (!Array.isArray(result)) return [];
	const first = result[0] as { results?: unknown } | undefined;
	if (first && Array.isArray(first.results)) {
		return first.results as Record<string, unknown>[];
	}
	return [];
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
	if (typeof raw !== 'string') {
		return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function toNonEmptyString(value: unknown): string {
	return typeof value === 'string' && value.length > 0 ? value : '';
}
