import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

import db from '$lib/server/db';
import { tableAppMeta } from '$lib/server/db/schema';
import {
	compareVersions,
	fetchLatestRelease,
	getAppVersion,
	startDownload,
	updateDownloadBaseDir,
	type ReleaseSummary,
	type UpdateAsset
} from './update-manager';

/**
 * Mesin auto update.
 *
 * Alur otomatis (semua berjalan di server, tanpa perlu admin menekan tombol):
 *   1. Cek GitHub Releases secara berkala (bawaan tiap 1 jam + sekali saat start).
 *   2. Kalau ada versi lebih baru → unduh installer di background.
 *   3. Kalau unduhan selesai → installer dijalankan segera di latar belakang
 *      (tanpa menunggu aplikasi menganggur maupun jendela jam), lalu aplikasi
 *      direstart oleh helper `scripts/auto-update.mjs`.
 *
 * Pengaturan & status disimpan di tabel `app_meta` (key-value) supaya tetap
 * ada setelah aplikasi dimulai ulang.
 */

const SETTINGS_KEY = 'update.auto.settings';
const STATE_KEY = 'update.auto.state';

export interface AutoUpdateSettings {
	/** Master switch: tanpa ini tidak ada pemeriksaan, unduhan, maupun pemasangan otomatis. */
	enabled: boolean;
	/** Unduh installer di background begitu versi baru ditemukan. */
	autoDownload: boolean;
	/** Pasang otomatis di latar belakang segera setelah installer terunduh. */
	autoInstall: boolean;
	/** Jarak antar pemeriksaan ke GitHub (menit). */
	intervalMinutes: number;
}

export const DEFAULT_AUTO_UPDATE_SETTINGS: AutoUpdateSettings = {
	enabled: true,
	autoDownload: true,
	autoInstall: true,
	intervalMinutes: 60
};

export interface UpdateAutoState {
	lastCheckAt: string | null;
	lastError: string | null;
	latestVersion: string | null;
	latestName: string | null;
	latestNotes: string | null;
	latestPublishedAt: string | null;
	latestAssetId: number | null;
	latestAssetName: string | null;
	latestAssetUrl: string | null;
	latestAssetSize: number | null;
	downloadId: string | null;
	installStartedAt: string | null;
}

const EMPTY_STATE: UpdateAutoState = {
	lastCheckAt: null,
	lastError: null,
	latestVersion: null,
	latestName: null,
	latestNotes: null,
	latestPublishedAt: null,
	latestAssetId: null,
	latestAssetName: null,
	latestAssetUrl: null,
	latestAssetSize: null,
	downloadId: null,
	installStartedAt: null
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 30 * 1000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let firstRunTimer: ReturnType<typeof setTimeout> | null = null;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readMeta(key: string): Promise<string | null> {
	try {
		const row = await db.query.tableAppMeta.findFirst({ where: eq(tableAppMeta.key, key) });
		return row?.value ?? null;
	} catch (error) {
		// Database belum siap (instalasi baru) — diabaikan, scheduler akan mencoba lagi.
		console.warn('[update-auto] gagal membaca app_meta:', error);
		return null;
	}
}

async function writeMeta(key: string, value: string) {
	const timestamp = new Date().toISOString();
	await db
		.insert(tableAppMeta)
		.values({ key, value, createdAt: timestamp, updatedAt: timestamp })
		.onConflictDoUpdate({ target: tableAppMeta.key, set: { value, updatedAt: timestamp } });
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toBoolean(value: unknown, fallback: boolean) {
	if (typeof value === 'boolean') return value;
	if (value === '1' || value === 'true') return true;
	if (value === '0' || value === 'false') return false;
	return fallback;
}

export async function getAutoUpdateSettings(): Promise<AutoUpdateSettings> {
	const raw = await readMeta(SETTINGS_KEY);
	if (!raw) return { ...DEFAULT_AUTO_UPDATE_SETTINGS };
	try {
		const parsed = JSON.parse(raw) as Partial<AutoUpdateSettings>;
		return {
			enabled: toBoolean(parsed.enabled, DEFAULT_AUTO_UPDATE_SETTINGS.enabled),
			autoDownload: toBoolean(parsed.autoDownload, DEFAULT_AUTO_UPDATE_SETTINGS.autoDownload),
			autoInstall: toBoolean(parsed.autoInstall, DEFAULT_AUTO_UPDATE_SETTINGS.autoInstall),
			intervalMinutes: clampInt(
				parsed.intervalMinutes,
				15,
				24 * 60,
				DEFAULT_AUTO_UPDATE_SETTINGS.intervalMinutes
			)
		};
	} catch {
		return { ...DEFAULT_AUTO_UPDATE_SETTINGS };
	}
}

export async function saveAutoUpdateSettings(
	input: Partial<AutoUpdateSettings>
): Promise<AutoUpdateSettings> {
	const current = await getAutoUpdateSettings();
	const next: AutoUpdateSettings = {
		enabled: toBoolean(input.enabled, current.enabled),
		autoDownload: toBoolean(input.autoDownload, current.autoDownload),
		autoInstall: toBoolean(input.autoInstall, current.autoInstall),
		intervalMinutes: clampInt(input.intervalMinutes, 15, 24 * 60, current.intervalMinutes)
	};
	await writeMeta(SETTINGS_KEY, JSON.stringify(next));
	return next;
}

export async function getUpdateAutoState(): Promise<UpdateAutoState> {
	const raw = await readMeta(STATE_KEY);
	if (!raw) return { ...EMPTY_STATE };
	try {
		const parsed = JSON.parse(raw) as Partial<UpdateAutoState>;
		return { ...EMPTY_STATE, ...parsed };
	} catch {
		return { ...EMPTY_STATE };
	}
}

export async function saveUpdateAutoState(state: UpdateAutoState) {
	await writeMeta(STATE_KEY, JSON.stringify(state));
}

/** Aset installer yang cocok: prefer file .exe (Inno Setup), fallback aset pertama. */
export function pickInstallerAsset(release: ReleaseSummary | null): UpdateAsset | null {
	if (!release || !release.assets?.length) return null;
	const exe = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'));
	return exe ?? release.assets[0] ?? null;
}

/** Lokasi file installer yang sudah terunduh di disk (bertahan lintas restart). */
export function findDownloadedInstaller(
	version: string | null,
	assetName: string | null
): string | null {
	if (!version || !assetName) return null;
	const candidate = join(updateDownloadBaseDir, version, assetName);
	try {
		if (!existsSync(candidate)) return null;
		if (statSync(candidate).size <= 0) return null;
		return candidate;
	} catch {
		return null;
	}
}

export interface UpdateCheckResult {
	ok: boolean;
	updateAvailable: boolean;
	skipped?: boolean;
	latest?: ReleaseSummary | null;
	error?: string;
}

/**
 * Periksa GitHub Releases lalu simpan hasilnya. `force` dipakai oleh tombol
 * "Periksa ulang" di UI (melewati interval dan sakelar otomatis).
 */
export async function runUpdateCheck(
	options: { force?: boolean } = {}
): Promise<UpdateCheckResult> {
	const settings = await getAutoUpdateSettings();
	const state = await getUpdateAutoState();

	if (!settings.enabled && !options.force) {
		return { ok: true, updateAvailable: false, skipped: true };
	}

	if (!options.force && state.lastCheckAt) {
		const elapsed = Date.now() - new Date(state.lastCheckAt).getTime();
		if (Number.isFinite(elapsed) && elapsed < settings.intervalMinutes * 60_000) {
			return { ok: true, updateAvailable: false, skipped: true };
		}
	}

	const currentVersion = getAppVersion();
	let release: ReleaseSummary;
	try {
		release = await fetchLatestRelease();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Gagal memeriksa pembaruan.';
		await saveUpdateAutoState({
			...state,
			lastCheckAt: new Date().toISOString(),
			lastError: message
		});
		console.error('[update-auto] pemeriksaan pembaruan gagal:', message);
		return { ok: false, updateAvailable: false, error: message };
	}

	const updateAvailable = compareVersions(release.version, currentVersion) > 0;
	const asset = pickInstallerAsset(release);
	const nextState: UpdateAutoState = {
		...state,
		lastCheckAt: new Date().toISOString(),
		lastError: null,
		latestVersion: release.version,
		latestName: release.name,
		latestNotes: release.notes,
		latestPublishedAt: release.publishedAt,
		latestAssetId: asset?.id ?? null,
		latestAssetName: asset?.name ?? null,
		latestAssetUrl: asset?.downloadUrl ?? null,
		latestAssetSize: asset?.size ?? null
	};
	await saveUpdateAutoState(nextState);

	if (!updateAvailable || !asset) {
		return { ok: true, updateAvailable: false, latest: release };
	}

	if (settings.enabled && settings.autoDownload) {
		const alreadyDownloaded = findDownloadedInstaller(release.version, asset.name);
		if (!alreadyDownloaded) {
			const record = startDownload({
				version: release.version,
				assetId: asset.id,
				assetName: asset.name,
				assetUrl: asset.downloadUrl,
				size: asset.size
			});
			await saveUpdateAutoState({ ...nextState, downloadId: record.id });
			console.info(`[update-auto] mulai mengunduh v${release.version} di background`);
		}
	}

	return { ok: true, updateAvailable: true, latest: release };
}

/**
 * Jalankan installer otomatis bila semua syarat terpenuhi: versi baru, unduhan
 * selesai, dan platform Windows. Pemasangan berjalan instan di latar belakang —
 * tanpa gerbang "aplikasi menganggur" maupun jendela jam pemasangan.
 */
export async function maybeAutoInstall(): Promise<boolean> {
	const settings = await getAutoUpdateSettings();
	if (!settings.enabled || !settings.autoInstall) return false;

	const state = await getUpdateAutoState();
	if (state.installStartedAt) {
		// Installer yang gagal (mis. file hilang) tidak boleh memblokir percobaan
		// selamanya — izinkan ulang setelah 24 jam.
		const since = Date.now() - new Date(state.installStartedAt).getTime();
		if (Number.isFinite(since) && since < 24 * 60 * 60 * 1000) return false;
	}
	if (!state.latestVersion || !state.latestAssetName) return false;

	const currentVersion = getAppVersion();
	if (compareVersions(state.latestVersion, currentVersion) <= 0) return false;

	const installerPath = findDownloadedInstaller(state.latestVersion, state.latestAssetName);
	if (!installerPath) return false;

	if (process.platform !== 'win32') {
		console.warn('[update-auto] pemasangan otomatis hanya didukung di Windows.');
		return false;
	}

	// Hanya untuk aplikasi yang benar-benar terinstall (ada launcher di folder
	// aplikasi). Mode dev/pnpm start tidak boleh menjalankan installer.
	if (!existsSync(join(process.cwd(), 'start-erapor-pmk.mjs'))) {
		console.warn(
			'[update-auto] pemasangan otomatis hanya aktif pada instalasi Windows (launcher tidak ditemukan).'
		);
		return false;
	}

	await triggerAutoInstall(installerPath);
	return true;
}

async function triggerAutoInstall(installerPath: string) {
	const helper = join(process.cwd(), 'scripts', 'auto-update.mjs');
	if (!existsSync(helper)) {
		console.warn('[update-auto] helper scripts/auto-update.mjs tidak ditemukan, Lewati.');
		return;
	}

	const port = process.env.PORT ?? '3000';
	const appDir = process.cwd();

	const child = spawn(
		process.execPath,
		[helper, '--installer', installerPath, '--port', port, '--app-dir', appDir],
		{ detached: true, stdio: 'ignore', windowsHide: true }
	);
	child.unref();

	const state = await getUpdateAutoState();
	await saveUpdateAutoState({ ...state, installStartedAt: new Date().toISOString() });
	console.info('[update-auto] installer dijalankan otomatis:', installerPath);

	// Beri waktu helper attaches sebelum server dimatikan.
	await sleep(1500);
	process.exit(0);
}

/**
 * Ringkasan untuk UI/API: pengaturan, status terakhir, dan apakah versi baru tersedia.
 */
export async function getUpdateOverview() {
	const settings = await getAutoUpdateSettings();
	const state = await getUpdateAutoState();
	const currentVersion = getAppVersion();
	const updateAvailable = Boolean(
		state.latestVersion && compareVersions(state.latestVersion, currentVersion) > 0
	);
	const installerPath = findDownloadedInstaller(state.latestVersion, state.latestAssetName);

	return {
		currentVersion,
		updateAvailable,
		settings,
		state,
		downloaded: Boolean(installerPath),
		downloadedPath: installerPath
	};
}

/** Mulai penjadwal auto update (dipanggil sekali saat server boot). */
export async function startUpdateScheduler() {
	if (schedulerTimer) return;

	const tick = async () => {
		try {
			const settings = await getAutoUpdateSettings();
			if (settings.enabled) {
				await runUpdateCheck();
			}
			await maybeAutoInstall();
		} catch (error) {
			console.error('[update-auto] tick gagal:', error);
		}
	};

	// Tunggu schema & data awal siap sebelum pemeriksaan pertama.
	firstRunTimer = setTimeout(() => {
		void tick();
	}, FIRST_CHECK_DELAY_MS);
	schedulerTimer = setInterval(() => {
		void tick();
	}, CHECK_INTERVAL_MS);

	console.info('[update-auto] penjadwal auto update aktif');
}

export function stopUpdateScheduler() {
	if (firstRunTimer) {
		clearTimeout(firstRunTimer);
		firstRunTimer = null;
	}
	if (schedulerTimer) {
		clearInterval(schedulerTimer);
		schedulerTimer = null;
	}
}
