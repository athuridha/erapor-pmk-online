#!/usr/bin/env node
/**
 * Ambil screenshot halaman aplikasi untuk README.
 *
 * Butuh dev server yang sudah jalan (default http://localhost:5173) dan login
 * admin. Hasil disimpan ke static/ lalu dipakai di README.
 *
 * Contoh:
 *   node scripts/screenshot-readme.mjs
 *   BASE_URL=http://localhost:5173 node scripts/screenshot-readme.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const username = process.env.APP_USERNAME || 'Admin';
const password = process.env.APP_PASSWORD || 'Admin123';
const outputDir = path.join(projectRoot, 'static');

/** Halaman yang difoto + nama file hasilnya. */
const HALAMAN = [
	{ path: '/', file: 'screenshot-dashboard.png' },
	{ path: '/cetak/kustomisasi', file: 'screenshot-kustomisasi-cetak.png' },
	{ path: '/master-data/pengguna/guru', file: 'screenshot-data-pengguna.png' },
	{ path: '/master-data/ekstrakurikuler', file: 'screenshot-master-data.png' },
	{ path: '/presensi-murid', file: 'screenshot-presensi-murid.png' }
];

function findChrome() {
	if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
	const localAppData = process.env.LOCALAPPDATA || '';
	const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
	const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
	const candidates = [
		`${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
		`${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
		`${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
		`${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
		`${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return undefined;
}

const executablePath = findChrome();
if (!executablePath) {
	console.error('Chrome/Edge tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH.');
	process.exit(1);
}

const browser = await puppeteer.launch({
	executablePath,
	headless: true,
	args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
});

try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });

	// Login
	await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
	await page.waitForSelector('input[name="username"]', { timeout: 20000 });
	await page.type('input[name="username"]', username, { delay: 10 });
	await page.type('input[name="password"]', password, { delay: 10 });
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
		page.click('button[type="submit"]')
	]);
	console.log('Login selesai:', page.url());

	for (const halaman of HALAMAN) {
		await page.goto(`${baseUrl}${halaman.path}`, {
			waitUntil: 'networkidle2',
			timeout: 60000
		});
		// Preview kustomisasi butuh HTML besar (base64 logo/QR) — tunggu sampai iframe terisi.
		await page
			.waitForFunction(
				() => {
					const frame = document.querySelector('iframe');
					return !frame || (frame.getAttribute('srcdoc') || '').length > 2000;
				},
				{ timeout: 30000 }
			)
			.catch(() => null);
		// Beri waktu animasi/hydrasi selesai.
		await new Promise((resolve) => setTimeout(resolve, 1500));
		const target = path.join(outputDir, halaman.file);
		await page.screenshot({ path: target });
		console.log('Tersimpan:', path.relative(projectRoot, target));
	}
} finally {
	await browser.close();
}
