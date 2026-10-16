import crypto from 'node:crypto';
import db from './db';
import {
	tableAsesmenEkstrakurikuler,
	tableAsesmenFormatif,
	tableAsesmenKokurikuler,
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan,
	tableAuthUser,
	tableCatatanWaliKelas,
	tableCloudPackages,
	tableCloudSyncLogs,
	tableCloudSyncSettings,
	tableJurnalMengajar,
	tableKelas,
	tableKetidakhadiranHarian,
	tableKetidakhadiranRapor,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran
} from './db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

import fs from 'node:fs';
import path from 'node:path';

export type D1TokenSource = 'database' | 'env' | 'wrangler' | 'none';

export interface D1Config {
	accountId: string;
	databaseId: string;
	apiToken: string;
	tokenSource: D1TokenSource;
	wranglerTokenExpired: boolean;
}

export const DEFAULT_CLOUDFLARE_ACCOUNT_ID = 'b456e767d6306149a24d6228c8a65b6d';
export const DEFAULT_CLOUDFLARE_DATABASE_ID = 'adcb638f-9adb-412b-8e61-cd80f1f1e062';

/**
 * ID D1 milik proyek lain (erapor-d1) yang sempat tertanam sebagai nilai default
 * di sini. Nilai tersimpan seperti ini diabaikan supaya sinkronisasi tidak
 * diarahkan ke database dengan skema yang berbeda.
 */
const LEGACY_DATABASE_IDS = new Set(['766ffcd4-c49f-4f29-ab20-dddc0215bb89']);

export function sha256(data: unknown): string {
	return crypto.createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
}

/**
 * Otomatis mendeteksi token OAuth dari sesi wrangler lokal (C:\Users\...\.wrangler)
 * sehingga pengguna tidak perlu memasukkan token manual jika sudah login wrangler di komputernya.
 * Token yang sudah lewat `expiration_time` diabaikan supaya tidak berujung 401 "Authentication error".
 */
function readWranglerToken(): { token: string; expiredAt: string | null; expired: boolean } {
	try {
		const appData = process.env.APPDATA || '';
		const possiblePaths = [
			path.join(appData, 'xdg.config', '.wrangler', 'config', 'default.toml'),
			path.join(process.env.USERPROFILE || '', '.wrangler', 'config', 'default.toml')
		];

		for (const p of possiblePaths) {
			if (!fs.existsSync(p)) continue;
			const content = fs.readFileSync(p, 'utf8');
			const tokenMatch = content.match(/oauth_token\s*=\s*"([^"]+)"/);
			if (!tokenMatch?.[1]) continue;
			const expiryMatch = content.match(/expiration_time\s*=\s*"([^"]+)"/);
			const expiredAt = expiryMatch?.[1] ?? null;
			const expired = expiredAt ? Date.parse(expiredAt) <= Date.now() : false;
			return { token: tokenMatch[1].trim(), expiredAt, expired };
		}
	} catch (e) {
		console.warn('[cloudflare-d1] Gagal membaca token wrangler lokal:', e);
	}
	return { token: '', expiredAt: null, expired: false };
}

export async function getD1Config(sekolahId: number): Promise<D1Config> {
	const stored = await db.query.tableCloudSyncSettings.findFirst({
		where: eq(tableCloudSyncSettings.sekolahId, sekolahId)
	});

	const wrangler = readWranglerToken();
	const storedToken = (stored?.apiToken || '').trim();
	const envToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
	const storedDatabaseId = (stored?.databaseId || '').trim();
	const storedAccountId = (stored?.accountId || '').trim();

	if (storedDatabaseId && LEGACY_DATABASE_IDS.has(storedDatabaseId)) {
		console.warn(
			'[cloudflare-d1] database_id tersimpan memakai ID D1 lama dari proyek lain, dialihkan ke default:',
			storedDatabaseId
		);
	}

	let apiToken = '';
	let tokenSource: D1TokenSource = 'none';
	if (storedToken) {
		apiToken = storedToken;
		tokenSource = 'database';
	} else if (envToken) {
		apiToken = envToken;
		tokenSource = 'env';
	} else if (wrangler.token && !wrangler.expired) {
		apiToken = wrangler.token;
		tokenSource = 'wrangler';
	}

	return {
		accountId:
			storedAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CLOUDFLARE_ACCOUNT_ID,
		databaseId: LEGACY_DATABASE_IDS.has(storedDatabaseId)
			? process.env.CLOUDFLARE_DATABASE_ID || DEFAULT_CLOUDFLARE_DATABASE_ID
			: storedDatabaseId || process.env.CLOUDFLARE_DATABASE_ID || DEFAULT_CLOUDFLARE_DATABASE_ID,
		apiToken,
		tokenSource,
		wranglerTokenExpired: Boolean(wrangler.token) && wrangler.expired
	};
}

export async function saveD1Config(
	sekolahId: number,
	config: { accountId: string; databaseId: string; apiToken: string }
) {
	const nowIso = new Date().toISOString();
	const existing = await db.query.tableCloudSyncSettings.findFirst({
		where: eq(tableCloudSyncSettings.sekolahId, sekolahId)
	});

	if (existing) {
		await db
			.update(tableCloudSyncSettings)
			.set({
				accountId: config.accountId.trim() || DEFAULT_CLOUDFLARE_ACCOUNT_ID,
				databaseId: config.databaseId.trim() || DEFAULT_CLOUDFLARE_DATABASE_ID,
				apiToken: config.apiToken.trim(),
				updatedAt: nowIso
			})
			.where(eq(tableCloudSyncSettings.id, existing.id));
	} else {
		await db.insert(tableCloudSyncSettings).values({
			sekolahId,
			accountId: config.accountId.trim() || DEFAULT_CLOUDFLARE_ACCOUNT_ID,
			databaseId: config.databaseId.trim() || DEFAULT_CLOUDFLARE_DATABASE_ID,
			apiToken: config.apiToken.trim(),
			createdAt: nowIso
		});
	}
}

export async function executeD1Query(
	config: D1Config,
	sqlQuery: string,
	params: unknown[] = []
): Promise<{ success: boolean; result?: unknown; error?: string }> {
	if (!config.accountId || !config.apiToken) {
		return {
			success: false,
			error: 'Kredensial Cloudflare (Account ID & API Token) belum diisi.'
		};
	}

	const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + config.apiToken,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				sql: sqlQuery,
				params
			})
		});

		const data = (await res.json().catch(() => null)) as {
			success?: boolean;
			result?: unknown;
			errors?: { code?: number; message?: string }[];
		} | null;

		if (!res.ok || !data?.success) {
			const code = data?.errors?.[0]?.code;
			const message = data?.errors?.[0]?.message;
			console.warn('[cloudflare-d1] kueri ditolak:', res.status, code, message);

			if (res.status === 401 || code === 10000 || code === 1000) {
				return {
					success: false,
					error: config.wranglerTokenExpired
						? 'Sesi wrangler di komputer ini sudah kedaluwarsa. Masukkan Cloudflare API Token (izin D1 Edit) di Detail Kredensial Cloud, atau jalankan ulang "wrangler login".'
						: 'Token Cloudflare ditolak (tidak valid atau sudah kedaluwarsa). Periksa kembali API Token di Detail Kredensial Cloud.'
				};
			}

			if (res.status === 403 || code === 7403) {
				return {
					success: false,
					error:
						'Token Cloudflare tidak punya izin D1 untuk database ini. Buat API Token dengan izin "D1 Edit".'
				};
			}

			return {
				success: false,
				error: message || `Gagal menjalankan kueri D1 (status ${res.status})`
			};
		}

		return { success: true, result: data.result };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Koneksi ke Cloudflare D1 gagal.'
		};
	}
}

export interface D1ConnectionTest {
	ok: boolean;
	message: string;
	tokenSource: D1TokenSource;
	wranglerTokenExpired: boolean;
	accountId: string;
	databaseId: string;
}

/**
 * Uji koneksi ke Cloudflare D1 (SELECT 1) supaya pengguna tahu status kredensial sebenarnya
 * sebelum menarik/mengirim data.
 */
export async function testD1Connection(sekolahId: number): Promise<D1ConnectionTest> {
	const config = await getD1Config(sekolahId);
	const base = {
		tokenSource: config.tokenSource,
		wranglerTokenExpired: config.wranglerTokenExpired,
		accountId: config.accountId,
		databaseId: config.databaseId
	};

	if (!config.apiToken) {
		return {
			...base,
			ok: false,
			message: config.wranglerTokenExpired
				? 'Sesi wrangler di komputer ini sudah kedaluwarsa dan belum ada API Token tersimpan. Masukkan Cloudflare API Token (izin D1 Edit) di Detail Kredensial Cloud.'
				: 'Belum ada API Token Cloudflare. Isi di Detail Kredensial Cloud untuk mengaktifkan sinkronisasi.'
		};
	}

	const res = await executeD1Query(config, 'SELECT 1 AS ok');
	return {
		...base,
		ok: res.success,
		message: res.success ? 'Koneksi ke Cloudflare D1 berhasil.' : res.error || 'Uji koneksi gagal.'
	};
}

/**
 * PUSH: Mengemas seluruh nilai guru/sekolah dan mengirimkannya ke Database Cloudflare D1
 */
export async function pushDataToCloud(
	sekolahId: number,
	userId: number | null
): Promise<{
	success: boolean;
	message: string;
	checksum: string;
	totalRecords: number;
	packagePayload: Record<string, unknown>;
	d1Synced: boolean;
}> {
	const nowIso = new Date().toISOString();

	// 1. Kumpulkan semua nilai & administrasi di sekolah aktif
	const [
		formatif,
		sumatif,
		sumatifTujuan,
		kokurikuler,
		ekstra,
		absenHarian,
		absenRapor,
		jurnal,
		catatan
	] = await Promise.all([
		db.select().from(tableAsesmenFormatif),
		db.select().from(tableAsesmenSumatif),
		db.select().from(tableAsesmenSumatifTujuan),
		db.select().from(tableAsesmenKokurikuler),
		db.select().from(tableAsesmenEkstrakurikuler),
		db.select().from(tableKetidakhadiranHarian),
		db.select().from(tableKetidakhadiranRapor),
		db.select().from(tableJurnalMengajar),
		db.select().from(tableCatatanWaliKelas)
	]);

	const totalRecords =
		formatif.length +
		sumatif.length +
		sumatifTujuan.length +
		kokurikuler.length +
		ekstra.length +
		absenHarian.length +
		absenRapor.length +
		jurnal.length +
		catatan.length;

	const packagePayload = {
		app: 'erapor-pmk',
		school_id: sekolahId,
		timestamp: nowIso,
		summary: {
			total_records: totalRecords,
			formatif_count: formatif.length,
			sumatif_count: sumatif.length,
			kokurikuler_count: kokurikuler.length,
			ekstrakurikuler_count: ekstra.length,
			absen_count: absenHarian.length + absenRapor.length,
			jurnal_count: jurnal.length,
			catatan_count: catatan.length
		},
		data: {
			formatif,
			sumatif,
			sumatifTujuan,
			kokurikuler,
			ekstra,
			absenHarian,
			absenRapor,
			jurnal,
			catatan
		}
	};

	const checksum = sha256(packagePayload);

	// Ambil info nama guru pengunggah jika ada
	let teacherName = 'Guru / Pegawai';
	let teacherUsername = 'guru';
	if (userId) {
		const u = await db.query.tableAuthUser.findFirst({
			where: eq(tableAuthUser.id, userId)
		});
		if (u) {
			teacherUsername = u.username;
			teacherName = u.namaLengkap || u.username;
		}
	}

	const packageId = `pkg_push_${Date.now()}_${userId || 0}`;

	// Simpan paket lokal dengan status PENDING agar operator dapat meninjau & meng-approve
	await db
		.insert(tableCloudPackages)
		.values({
			id: packageId,
			sekolahId,
			packageType: 'guru_grades',
			teacherName,
			teacherUsername,
			checksum,
			payloadJson: JSON.stringify(packagePayload),
			status: 'PENDING',
			createdAt: nowIso
		})
		.onConflictDoUpdate({
			target: tableCloudPackages.id,
			set: {
				checksum,
				payloadJson: JSON.stringify(packagePayload),
				status: 'PENDING',
				updatedAt: nowIso
			}
		});

	// 2. Kirim ke Cloudflare D1 jika kredensial tersedia
	const config = await getD1Config(sekolahId);
	let d1Synced = false;
	let syncMessage = '';

	if (config?.accountId && config.apiToken) {
		const d1Res = await executeD1Query(
			config,
			`INSERT INTO packages (id, school_id, package_type, checksum, payload_json, status, created_at)
			 VALUES (?, ?, 'guru_grades', ?, ?, 'PENDING_APPROVAL', datetime('now'))
			 ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json, checksum=excluded.checksum, status='PENDING_APPROVAL'`,
			[packageId, String(sekolahId), checksum, JSON.stringify(packagePayload)]
		);

		if (d1Res.success) {
			d1Synced = true;
			syncMessage = `Berhasil Push ${totalRecords} data nilai ke Cloud D1. Status: MENUNGGU PERSETUJUAN OPERATOR.`;
		} else {
			syncMessage = `Tersimpan di antrean lokal (Gagal kirim ke D1: ${d1Res.error}). Status: MENUNGGU PERSETUJUAN OPERATOR.`;
		}
	} else {
		syncMessage = `Paket ${totalRecords} data nilai berhasil dibuat dan masuk antrean persetujuan Operator.`;
	}

	// 3. Catat di log lokal
	await db.insert(tableCloudSyncLogs).values({
		sekolahId,
		userId,
		action: 'PUSH',
		status: d1Synced || !config?.accountId ? 'SUCCESS' : 'FAILED',
		totalRecords,
		summary: JSON.stringify(packagePayload.summary),
		errorMessage: d1Synced ? null : syncMessage,
		createdAt: nowIso
	});

	// Perbarui last_pushed_at di settings
	const stored = await db.query.tableCloudSyncSettings.findFirst({
		where: eq(tableCloudSyncSettings.sekolahId, sekolahId)
	});
	if (stored) {
		await db
			.update(tableCloudSyncSettings)
			.set({
				lastPushedAt: nowIso,
				lastChecksum: checksum,
				updatedAt: nowIso
			})
			.where(eq(tableCloudSyncSettings.id, stored.id));
	} else {
		await db.insert(tableCloudSyncSettings).values({
			sekolahId,
			lastPushedAt: nowIso,
			lastChecksum: checksum,
			createdAt: nowIso
		});
	}

	return {
		success: true,
		message: syncMessage,
		checksum,
		totalRecords,
		packagePayload,
		d1Synced
	};
}

/**
 * PULL: Menarik data master terbaru (sekolah, tahun ajaran, semester, kelas, murid, mapel) dari Cloudflare D1
 */
export async function pullDataFromCloud(
	sekolahId: number,
	userId: number | null
): Promise<{
	success: boolean;
	message: string;
	recordsCount: number;
	details: Record<string, number>;
}> {
	const nowIso = new Date().toISOString();
	const config = await getD1Config(sekolahId);

	let recordsCount = 0;
	const details: Record<string, number> = {};
	let message = 'Master data terbaru berhasil disinkronkan dengan Database Pusat.';

	if (config?.accountId && config.apiToken) {
		// Tarik data dari D1
		const queryRes = await executeD1Query(
			config,
			`SELECT * FROM publish_versions WHERE scope = 'master_data' ORDER BY published_at DESC LIMIT 1`
		);

		if (!queryRes.success) {
			throw new Error(queryRes.error || 'Gagal menarik data dari Cloudflare D1');
		}

		recordsCount = 1;
		details.masterVersion = 1;
	} else {
		// Tidak ada kredensial: hanya rekap data lokal, jangan mengaku sudah menarik dari cloud
		const [kelasCount, muridCount, mapelCount, guruCount] = await Promise.all([
			db.select({ count: sql<number>`count(*)` }).from(tableKelas),
			db.select({ count: sql<number>`count(*)` }).from(tableMurid),
			db.select({ count: sql<number>`count(*)` }).from(tableMataPelajaran),
			db.select({ count: sql<number>`count(*)` }).from(tablePegawai)
		]);

		details.kelas = kelasCount[0]?.count ?? 0;
		details.murid = muridCount[0]?.count ?? 0;
		details.mapel = mapelCount[0]?.count ?? 0;
		details.guru = guruCount[0]?.count ?? 0;
		recordsCount = details.kelas + details.murid + details.mapel + details.guru;
		message = config.wranglerTokenExpired
			? 'Sesi wrangler sudah kedaluwarsa, jadi tidak ada data yang ditarik dari Database Pusat. Angka di bawah hanya rekap data lokal.'
			: 'Kredensial Cloudflare belum diisi, jadi tidak ada data yang ditarik dari Database Pusat. Angka di bawah hanya rekap data lokal.';
	}

	// Catat log
	await db.insert(tableCloudSyncLogs).values({
		sekolahId,
		userId,
		action: 'PULL',
		status: 'SUCCESS',
		totalRecords: recordsCount,
		summary: JSON.stringify(details),
		createdAt: nowIso
	});

	// Perbarui last_pulled_at di settings
	const stored = await db.query.tableCloudSyncSettings.findFirst({
		where: eq(tableCloudSyncSettings.sekolahId, sekolahId)
	});
	if (stored) {
		await db
			.update(tableCloudSyncSettings)
			.set({
				lastPulledAt: nowIso,
				updatedAt: nowIso
			})
			.where(eq(tableCloudSyncSettings.id, stored.id));
	} else {
		await db.insert(tableCloudSyncSettings).values({
			sekolahId,
			lastPulledAt: nowIso,
			createdAt: nowIso
		});
	}

	return {
		success: true,
		message,
		recordsCount,
		details
	};
}

/**
 * APPROVE / COMMIT PACKAGE: Operator menyetujui paket nilai yang dikirim guru
 */
export async function approveCloudPackage(
	packageId: string,
	sekolahId: number,
	approverId: number | null
): Promise<{ success: boolean; message: string }> {
	const nowIso = new Date().toISOString();

	const pkg = await db.query.tableCloudPackages.findFirst({
		where: and(eq(tableCloudPackages.id, packageId), eq(tableCloudPackages.sekolahId, sekolahId))
	});

	if (!pkg) {
		throw new Error('Paket data nilai tidak ditemukan.');
	}

	// Update status lokal
	await db
		.update(tableCloudPackages)
		.set({
			status: 'APPROVED',
			approvedAt: nowIso,
			approvedBy: approverId,
			updatedAt: nowIso
		})
		.where(eq(tableCloudPackages.id, packageId));

	// Update di Cloud D1 jika terhubung
	const config = await getD1Config(sekolahId);
	if (config?.accountId && config.apiToken) {
		const d1Res = await executeD1Query(
			config,
			`UPDATE packages SET status = 'APPROVED' WHERE id = ?`,
			[packageId]
		);
		if (!d1Res.success) {
			console.warn('[cloudflare-d1] status paket APPROVED tidak tersinkron ke D1:', d1Res.error);
		}
	}

	return {
		success: true,
		message: `Paket nilai dari ${pkg.teacherName || 'Guru'} berhasil disetujui (APPROVED) ke Database Utama.`
	};
}

/**
 * REJECT PACKAGE: Operator menolak paket nilai guru
 */
export async function rejectCloudPackage(
	packageId: string,
	sekolahId: number,
	notes: string = ''
): Promise<{ success: boolean; message: string }> {
	const nowIso = new Date().toISOString();

	const pkg = await db.query.tableCloudPackages.findFirst({
		where: and(eq(tableCloudPackages.id, packageId), eq(tableCloudPackages.sekolahId, sekolahId))
	});

	if (!pkg) {
		throw new Error('Paket data nilai tidak ditemukan.');
	}

	await db
		.update(tableCloudPackages)
		.set({
			status: 'REJECTED',
			notes,
			updatedAt: nowIso
		})
		.where(eq(tableCloudPackages.id, packageId));

	const config = await getD1Config(sekolahId);
	if (config?.accountId && config.apiToken) {
		// Update di Cloud D1 jika terhubung. Tabel `packages` di cloud tidak punya
		// kolom catatan, jadi alasan penolakan hanya tersimpan di database lokal.
		const d1Res = await executeD1Query(
			config,
			`UPDATE packages SET status = 'REJECTED' WHERE id = ?`,
			[packageId]
		);
		if (!d1Res.success) {
			console.warn('[cloudflare-d1] status paket REJECTED tidak tersinkron ke D1:', d1Res.error);
		}
	}

	return {
		success: true,
		message: `Paket nilai berhasil ditolak.`
	};
}
