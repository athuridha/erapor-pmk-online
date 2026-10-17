#!/usr/bin/env node
/**
 * Kompilasi installer Inno Setup dari stage yang sudah ada.
 *
 * Dipakai oleh `pnpm package:win:installer`. Sebelumnya path ISCC di-hardcode ke
 * "C:\Program Files (x86)\Inno Setup 6\ISCC.exe", sehingga gagal pada instalasi
 * per-user (winget --scope user) yang mendarat di %LOCALAPPDATA%\Programs.
 *
 * Pencarian compiler sama dengan yang dipakai scripts/prod-unsigned.mjs.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findISCC() {
	try {
		const r = spawnSync('wine', ['--version'], { stdio: 'ignore', shell: false });
		if (!r.error && r.status === 0) {
			const wineIscc = spawnSync('wine', ['iscc.exe', '--version'], {
				stdio: 'ignore',
				shell: false
			});
			if (!wineIscc.error && wineIscc.status === 0) return { cmd: 'wine', args: ['iscc.exe'] };
		}
	} catch {
		// abaikan: wine tidak ada
	}

	try {
		const r = spawnSync('iscc', ['/?'], { stdio: 'ignore', shell: false });
		if (!r.error && r.status === 0) return { cmd: 'iscc', args: [] };
	} catch {
		// abaikan: iscc tidak ada di PATH
	}

	const candidates = [];
	const versions = [7, 6, 5];
	for (const dir of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean)) {
		for (const v of versions) candidates.push(path.join(dir, `Inno Setup ${v}`, 'ISCC.exe'));
	}
	if (process.env.LOCALAPPDATA) {
		for (const v of versions) {
			candidates.push(
				path.join(process.env.LOCALAPPDATA, 'Programs', `Inno Setup ${v}`, 'ISCC.exe')
			);
		}
	}
	if (process.env.SystemRoot) {
		candidates.push(path.join(process.env.SystemRoot, 'System32', 'iscc.exe'));
	}
	if (process.env.HOME) {
		candidates.push(
			path.join(
				process.env.HOME,
				'.wine',
				'drive_c',
				'Program Files (x86)',
				'Inno Setup 6',
				'ISCC.exe'
			)
		);
	}
	for (const c of candidates) {
		try {
			if (fs.existsSync(c)) return { cmd: c, args: [] };
		} catch {
			// abaikan kandidat yang tidak bisa diperiksa
		}
	}

	return null;
}

const iscc = findISCC();
if (!iscc) {
	console.error(
		'[build-installer] ISCC.exe tidak ditemukan. Pasang Inno Setup 6+ (winget install JRSoftware.InnoSetup) atau tambahkan ke PATH.'
	);
	process.exit(1);
}

console.info(`[build-installer] Compiler: ${[iscc.cmd, ...iscc.args].join(' ')}`);

if (process.argv.includes('--check')) {
	process.exit(0);
}

const stageDir = path.join(projectRoot, 'dist', 'windows', 'stage', 'erapor-pmk');
if (!fs.existsSync(path.join(stageDir, 'build', 'index.js'))) {
	console.error(
		'[build-installer] Stage belum lengkap. Jalankan `pnpm build` lalu `pnpm package:win` dulu.'
	);
	process.exit(1);
}

const res = spawnSync(iscc.cmd, [...iscc.args, 'installer/erapor-pmk.iss'], {
	stdio: 'inherit',
	shell: false,
	cwd: projectRoot
});

if (res.error) {
	console.error('[build-installer] Gagal menjalankan compiler:', res.error);
	process.exit(1);
}
process.exit(res.status ?? 1);
