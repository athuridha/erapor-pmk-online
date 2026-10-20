#!/usr/bin/env node
/**
 * Publikasi rilis e-Rapor ke GitHub Releases.
 *
 * GitHub Releases inilah sumber pembaruan yang dipakai mesin auto update
 * di aplikasi, jadi setelah rilis dibuat, sekolah-sekolah yang sudah terinstall
 * akan otomatis mengunduh dan memasang versi baru.
 *
 * Contoh:
 *   pnpm release -- --version 0.1.1
 *   pnpm release -- --version 0.1.1 --dry-run
 *
 * Langkah:
 *   1. Validasi versi dan pastikan working tree bersih.
 *   2. Tulis versi baru ke package.json.
 *   3. Build installer (`pnpm prod`) → dist/windows/ERaporPMKSetup.exe.
 *   4. Commit + tag + push.
 *   5. Unggah installer ke GitHub Releases (pakai `gh` bila tersedia).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(projectRoot, 'package.json');
const installerPath = path.join(projectRoot, 'dist', 'windows', 'ERaporPMKSetup.exe');
const defaultRepo = 'athuridha/eraport';

function parseArgs(argv) {
	const args = {
		version: null,
		notesFile: null,
		skipBuild: false,
		dryRun: false,
		yes: false,
		prerelease: false
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const value = argv[i + 1];
		if (arg === '--version' && value) {
			args.version = value;
			i += 1;
		} else if (arg === '--notes-file' && value) {
			args.notesFile = value;
			i += 1;
		} else if (arg === '--skip-build') {
			args.skipBuild = true;
		} else if (arg === '--dry-run') {
			args.dryRun = true;
		} else if (arg === '--yes') {
			args.yes = true;
		} else if (arg === '--prerelease') {
			args.prerelease = true;
		} else if (arg === '--help' || arg === '-h') {
			args.help = true;
		}
	}
	return args;
}

function run(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: projectRoot,
		stdio: 'inherit',
		shell: false,
		...options
	});
	if (result.error) {
		throw new Error(`Gagal menjalankan ${command}: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`${command} ${commandArgs.join(' ')} keluar dengan kode ${result.status}`);
	}
	return result;
}

function capture(command, commandArgs) {
	const result = spawnSync(command, commandArgs, {
		cwd: projectRoot,
		stdio: ['ignore', 'pipe', 'pipe'],
		encoding: 'utf8',
		shell: false
	});
	if (result.error || result.status !== 0) return null;
	return (result.stdout ?? '').trim();
}

function currentBranch() {
	return capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
}

function hasUncommittedChanges() {
	const status = capture('git', ['status', '--porcelain']);
	return Boolean(status && status.length > 0);
}

function detectRepo() {
	const remote = capture('git', ['remote', 'get-url', 'origin']);
	if (!remote) return defaultRepo;
	const match = remote.match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/);
	if (!match) return defaultRepo;
	return `${match[1]}/${match[2]}`;
}

function lastTag() {
	return capture('git', ['describe', '--tags', '--abbrev=0']);
}

function buildNotes(version, previousTag) {
	if (args.notesFile) {
		const file = path.resolve(projectRoot, args.notesFile);
		if (!existsSync(file)) throw new Error(`File catatan rilis tidak ditemukan: ${file}`);
		return readFileSync(file, 'utf8').trim();
	}

	const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
	const log = capture('git', ['log', range, '--pretty=format:- %s']);
	const commits = log ? `\n\n${log}` : '';
	return `e-Rapor SMK Pratama Mulya v${version}${commits}`;
}

function confirm(question) {
	if (!process.stdin.isTTY) {
		throw new Error('Butuh konfirmasi interaktif. Jalankan ulang dengan --yes.');
	}
	process.stdout.write(`${question} (y/N) `);
	const answer = readFileSync(0, 'utf8').trim().toLowerCase();
	return answer === 'y' || answer === 'yes';
}

async function createReleaseWithApi(repo, tag, version, notes, token) {
	const headers = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'ERaporPMKRelease/1.0',
		Authorization: `Bearer ${token}`
	};

	const createResponse = await fetch(`https://api.github.com/repos/${repo}/releases`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			tag_name: tag,
			name: `e-Rapor SMK Pratama Mulya v${version}`,
			body: notes,
			prerelease: args.prerelease,
			draft: false
		})
	});

	if (!createResponse.ok) {
		const details = await createResponse.text().catch(() => '');
		throw new Error(`Gagal membuat rilis (${createResponse.status}): ${details}`);
	}

	const release = await createResponse.json();
	const assetBuffer = readFileSync(installerPath);
	const uploadResponse = await fetch(
		`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(path.basename(installerPath))}`,
		{
			method: 'POST',
			headers: {
				...headers,
				'Content-Type': 'application/octet-stream',
				'Content-Length': String(assetBuffer.length)
			},
			body: assetBuffer
		}
	);

	if (!uploadResponse.ok) {
		const details = await uploadResponse.text().catch(() => '');
		throw new Error(`Gagal mengunggah installer (${uploadResponse.status}): ${details}`);
	}

	return release.html_url;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
	console.info(`Publikasi rilis e-Rapor ke GitHub Releases.

Opsi:
  --version <versi>    Versi rilis (wajib, mis. 0.1.1)
  --notes-file <file>  File catatan rilis (default: daftar commit sejak tag terakhir)
  --skip-build         Lewati build installer (pakai artefak yang sudah ada)
  --dry-run            Tampilkan rencana tanpa menjalankan apa pun
  --yes                Lewati konfirmasi
  --prerelease         Tandai sebagai pre-release
`);
	process.exit(0);
}

async function main() {
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
	const version = args.version ?? pkg.version;
	const tag = `v${version}`;

	if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
		throw new Error(`Versi tidak valid: ${version}. Gunakan format semver, mis. 0.1.1`);
	}

	const repo = detectRepo();
	const branch = currentBranch();
	const previousTag = lastTag();
	const notes = buildNotes(version, previousTag);

	console.info('Rencana rilis:');
	console.info(`  Repositori   : ${repo}`);
	console.info(`  Branch       : ${branch}`);
	console.info(`  Versi        : ${version} (tag ${tag})`);
	console.info(`  Tag sebelumnya: ${previousTag ?? '(tidak ada)'}`);
	console.info(`  Installer    : ${path.relative(projectRoot, installerPath)}`);
	console.info(`  Prerelease   : ${args.prerelease ? 'ya' : 'tidak'}`);

	if (args.dryRun) {
		console.info('\nMode dry-run: tidak ada yang dieksekusi.');
		return;
	}

	if (!args.yes) {
		const ok = confirm(`Terbitkan rilis ${tag} ke ${repo}?`);
		if (!ok) {
			console.info('Dibatalkan.');
			return;
		}
	}

	if (hasUncommittedChanges()) {
		throw new Error('Working tree tidak bersih. Commit atau stash dulu sebelum menerbitkan rilis.');
	}

	if (pkg.version !== version) {
		console.info(`\nMemperbarui versi package.json → ${version}`);
		pkg.version = version;
		writeFileSync(pkgPath, `${JSON.stringify(pkg, null, '\t')}\n`);
		run('git', ['add', 'package.json']);
		run('git', ['commit', '-m', `release: ${tag}`]);
	}

	if (!args.skipBuild) {
		console.info('\nMembangun installer (pnpm prod)…');
		run('pnpm', ['prod']);
	} else {
		console.info('\nMelewati build installer (--skip-build).');
	}

	if (!existsSync(installerPath)) {
		throw new Error(`Installer tidak ditemukan: ${installerPath}`);
	}

	console.info(`\nMenerbitkan tag ${tag}…`);
	const tagExists = capture('git', ['tag', '--list', tag]);
	if (!tagExists) {
		run('git', ['tag', '-a', tag, '-m', `e-Rapor v${version}`]);
	}
	run('git', ['push', 'origin', branch]);
	run('git', ['push', 'origin', tag]);

	console.info('\nMembuat GitHub Release…');
	let releaseUrl;
	const ghAvailable = capture('gh', ['--version']);
	if (ghAvailable) {
		const notesFile = path.join(projectRoot, 'dist', 'windows', 'release-notes.md');
		writeFileSync(notesFile, `${notes}\n`, 'utf8');
		const ghArgs = [
			'release',
			'create',
			tag,
			installerPath,
			'--repo',
			repo,
			'--title',
			`e-Rapor SMK Pratama Mulya v${version}`,
			'--notes-file',
			notesFile
		];
		if (args.prerelease) ghArgs.push('--prerelease');
		run('gh', ghArgs);
		releaseUrl = capture('gh', [
			'release',
			'view',
			tag,
			'--repo',
			repo,
			'--json',
			'url',
			'-q',
			'.url'
		]);
	} else {
		const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
		if (!token) {
			throw new Error(
				'GitHub CLI (`gh`) tidak tersedia dan GITHUB_TOKEN/GH_TOKEN belum diisi. Pasang gh atau set token untuk mengunggah rilis.'
			);
		}
		releaseUrl = await createReleaseWithApi(repo, tag, version, notes, token);
	}

	console.info(
		`\nRilis terbit: ${releaseUrl ?? 'https://github.com/' + repo + '/releases/tag/' + tag}`
	);
	console.info('Sekolah yang terinstall akan menemukan versi ini lewat auto update.');
}

main().catch((error) => {
	console.error(`\nGagal menerbitkan rilis: ${error?.message ?? error}`);
	process.exitCode = 1;
});
