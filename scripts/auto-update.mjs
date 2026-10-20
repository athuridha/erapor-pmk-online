#!/usr/bin/env node
/**
 * Helper auto update.
 *
 * Dipanggil oleh mesin auto update (src/lib/server/update-auto.ts) setelah
 * installer terunduh. Urutan kerja:
 *
 *   1. Tunggu server e-Rapor benar-benar berhenti (port bebas) supaya berkas
 *      aplikasi tidak terkunci saat installer menulis.
 *   2. Jalankan installer Inno Setup secara senyap (/VERYSILENT).
 *   3. Jalankan ulang aplikasi (start-erapor-pmk.mjs) bila ada.
 *
 * Skrip ini dijalankan sebagai proses terpisah (detached) dari server, jadi
 * tetap hidup setelah server dimatikan.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
	const args = { installer: null, port: '3000', appDir: process.cwd() };
	for (let i = 0; i < argv.length; i += 1) {
		const key = argv[i];
		const value = argv[i + 1];
		if (key === '--installer' && value) {
			args.installer = value;
			i += 1;
		} else if (key === '--port' && value) {
			args.port = value;
			i += 1;
		} else if (key === '--app-dir' && value) {
			args.appDir = value;
			i += 1;
		}
	}
	return args;
}

const args = parseArgs(process.argv.slice(2));

const logDir = path.join(
	process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
	'erapor-pmk-data',
	'logs'
);
let logFile = path.join(logDir, 'auto-update.log');
try {
	mkdirSync(logDir, { recursive: true });
} catch {
	logFile = path.join(args.appDir, 'auto-update.log');
}

function log(message) {
	const line = `[${new Date().toISOString()}] ${message}`;
	console.info(line);
	try {
		appendFileSync(logFile, `${line}\n`);
	} catch {
		// ignore: log saja ke stdout
	}
}

function isPortBusy(port) {
	return new Promise((resolve) => {
		const socket = net.connect({ host: '127.0.0.1', port: Number(port) });
		const finish = (busy) => {
			socket.removeAllListeners();
			socket.destroy();
			resolve(busy);
		};
		socket.setTimeout(1000);
		socket.once('connect', () => finish(true));
		socket.once('timeout', () => finish(false));
		socket.once('error', () => finish(false));
	});
}

async function waitForServerStop(port, timeoutMs = 120_000) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (!(await isPortBusy(port))) return true;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}

function runInstaller(installerPath) {
	return new Promise((resolve) => {
		const child = spawn(
			installerPath,
			[
				'/VERYSILENT',
				'/SUPPRESSMSGBOXES',
				'/NORESTART',
				'/SP-',
				`/LOG=${path.join(logDir, 'installer-auto-update.log')}`
			],
			{ stdio: 'ignore', windowsHide: true }
		);
		child.on('error', (error) => {
			log(`Gagal menjalankan installer: ${error.message}`);
			resolve(-1);
		});
		child.on('exit', (code) => resolve(code ?? -1));
	});
}

function relaunchApp(appDir) {
	const launcher = path.join(appDir, 'start-erapor-pmk.mjs');
	if (existsSync(launcher)) {
		log('Menjalankan ulang aplikasi lewat start-erapor-pmk.mjs');
		const child = spawn(process.execPath, [launcher], {
			cwd: appDir,
			detached: true,
			stdio: 'ignore',
			windowsHide: true
		});
		child.unref();
		return true;
	}

	const built = path.join(appDir, 'build', 'index.js');
	if (existsSync(built)) {
		log('Menjalankan ulang aplikasi lewat build/index.js');
		const child = spawn(process.execPath, [built], {
			cwd: appDir,
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
			env: { ...process.env }
		});
		child.unref();
		return true;
	}

	log('Tidak ada launcher untuk menyalakan ulang aplikasi.');
	return false;
}

async function main() {
	if (!args.installer) {
		log('Argument --installer wajib diisi.');
		process.exit(1);
	}

	if (!existsSync(args.installer)) {
		log(`Installer tidak ditemukan: ${args.installer}`);
		process.exit(1);
	}

	log(`Menunggu server berhenti di port ${args.port}…`);
	const stopped = await waitForServerStop(args.port);
	if (!stopped) {
		log('Server masih berjalan setelah batas waktu — pemasangan dibatalkan.');
		process.exit(1);
	}

	log('Server berhenti. Menjalankan installer secara senyap…');
	const exitCode = await runInstaller(args.installer);
	if (exitCode !== 0) {
		log(`Installer selesai dengan kode ${exitCode}.`);
	} else {
		log('Installer selesai (sukses).');
	}

	relaunchApp(args.appDir);
	process.exit(0);
}

main().catch((error) => {
	log(`Gagal tak terduga: ${error?.message ?? error}`);
	process.exit(1);
});
