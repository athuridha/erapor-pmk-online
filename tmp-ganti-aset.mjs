/**
 * Ganti aset installer pada sebuah GitHub Release (hapus aset lama, upload baru).
 * Dipakai setelah build ulang installer tanpa harus membuat rilis baru.
 *
 * Contoh: node tmp-ganti-aset.mjs v0.1.4 dist/windows/ERaporPMKSetup.exe
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [tag, file] = process.argv.slice(2);
if (!tag || !file) {
	console.error('Pakai: node tmp-ganti-aset.mjs <tag> <file>');
	process.exit(1);
}

const repo = 'athuridha/eraport';
const token = process.env.GITHUB_TOKEN;
if (!token) {
	console.error('GITHUB_TOKEN belum diisi');
	process.exit(1);
}

const headers = {
	Accept: 'application/vnd.github+json',
	'User-Agent': 'ERaporPMKRelease/1.0',
	Authorization: `Bearer ${token}`
};

const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
	headers
});
if (!releaseRes.ok) {
	console.error('Gagal ambil rilis:', releaseRes.status, await releaseRes.text());
	process.exit(1);
}
const release = await releaseRes.json();
const namaAsset = path.basename(file);
console.log('Rilis:', release.tag_name, '| id', release.id);

for (const asset of release.assets ?? []) {
	if (asset.name !== namaAsset) continue;
	console.log('Menghapus aset lama:', asset.name, `(${Math.round(asset.size / 1048576)} MB)`);
	const del = await fetch(
		`https://api.github.com/repos/${repo}/releases/assets/${asset.id}`,
		{ method: 'DELETE', headers }
	);
	if (!del.ok && del.status !== 204) {
		console.error('Gagal hapus aset:', del.status, await del.text());
		process.exit(1);
	}
}

const buffer = readFileSync(file);
const upload = await fetch(
	`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(namaAsset)}`,
	{
		method: 'POST',
		headers: {
			...headers,
			'Content-Type': 'application/octet-stream',
			'Content-Length': String(buffer.length)
		},
		body: buffer
	}
);
if (!upload.ok) {
	console.error('Gagal upload:', upload.status, await upload.text());
	process.exit(1);
}
const asset = await upload.json();
console.log('Aset baru:', asset.name, `${Math.round(asset.size / 1048576)} MB`);
console.log('URL:', asset.browser_download_url);
