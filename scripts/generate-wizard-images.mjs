// Renders installer/assets/wizard.html into the Inno Setup wizard bitmaps
// (installer/assets/wizard-large.bmp & wizard-small.bmp) using headless Chrome.
// BMP 24-bit is used because Inno Setup only accepts BMP for wizard images.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';

const projectRoot = path.resolve(import.meta.dirname, '..');
const assetsDir = path.join(projectRoot, 'installer', 'assets');
const pageUrl = pathToFileURL(path.join(assetsDir, 'wizard.html'));

// Ukuran yang dikenali Inno Setup; gambar besar dirender 3x supaya tajam di HiDPI.
const variants = [
	{ variant: 'large', width: 164, height: 314, scale: 3, file: 'wizard-large.bmp' },
	{ variant: 'small', width: 55, height: 55, scale: 3, file: 'wizard-small.bmp' }
];

function findChrome() {
	const candidates = [
		process.env.PUPPETEER_EXECUTABLE_PATH,
		path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
		path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
		path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
		path.join(process.env.PROGRAMFILES ?? '', 'Microsoft/Edge/Application/msedge.exe'),
		path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe')
	].filter(Boolean);
	const found = candidates.find((file) => fs.existsSync(file));
	if (!found) {
		throw new Error('Chrome/Chromium tidak ditemukan; set PUPPETEER_EXECUTABLE_PATH');
	}
	return found;
}

function decodePng(buf) {
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	if (!buf.subarray(0, 8).equals(signature)) throw new Error('hasil tangkapan bukan PNG');
	let offset = 8;
	let header = null;
	const idat = [];
	while (offset < buf.length) {
		const length = buf.readUInt32BE(offset);
		const type = buf.toString('ascii', offset + 4, offset + 8);
		if (type === 'IHDR') header = buf.subarray(offset + 8, offset + 8 + length);
		else if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + length));
		else if (type === 'IEND') break;
		offset += 12 + length;
	}
	if (!header) throw new Error('IHDR tidak ditemukan');
	const width = header.readUInt32BE(0);
	const height = header.readUInt32BE(4);
	const colorType = header[9];
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
	if (header[8] !== 8 || header[12] !== 0 || channels === 0) {
		throw new Error(`format PNG tidak didukung (bitDepth=${header[8]} colorType=${colorType})`);
	}
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	const pixels = Buffer.alloc(height * stride);
	let cursor = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[cursor++];
		const row = raw.subarray(cursor, cursor + stride);
		cursor += stride;
		const current = pixels.subarray(y * stride, (y + 1) * stride);
		const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
		for (let i = 0; i < stride; i++) {
			const left = i >= channels ? current[i - channels] : 0;
			const up = previous[i];
			const upLeft = i >= channels ? previous[i - channels] : 0;
			let value = row[i];
			if (filter === 1) value += left;
			else if (filter === 2) value += up;
			else if (filter === 3) value += (left + up) >> 1;
			else if (filter === 4) {
				const p = Math.abs(up - upLeft);
				const q = Math.abs(left - upLeft);
				const r = Math.abs(left + up - 2 * upLeft);
				value += p <= q && p <= r ? left : q <= r ? up : upLeft;
			}
			current[i] = value & 0xff;
		}
	}
	return { width, height, channels, pixels };
}

// BMP 24-bit tanpa kompresi, baris bawah-ke-atas, tiap baris dipad ke kelipatan 4 byte.
function toBmp({ width, height, channels, pixels }) {
	const rowSize = Math.ceil((width * 3) / 4) * 4;
	const pixelData = Buffer.alloc(rowSize * height);
	for (let y = 0; y < height; y++) {
		const base = (height - 1 - y) * rowSize;
		for (let x = 0; x < width; x++) {
			const source = (y * width + x) * channels;
			const target = base + x * 3;
			pixelData[target] = pixels[source + 2];
			pixelData[target + 1] = pixels[source + 1];
			pixelData[target + 2] = pixels[source];
		}
	}
	const header = Buffer.alloc(54);
	header.write('BM', 0, 'ascii');
	header.writeUInt32LE(54 + pixelData.length, 2);
	header.writeUInt32LE(54, 10);
	header.writeUInt32LE(40, 14);
	header.writeInt32LE(width, 18);
	header.writeInt32LE(height, 22);
	header.writeUInt16LE(1, 26);
	header.writeUInt16LE(24, 28);
	header.writeUInt32LE(pixelData.length, 34);
	header.writeInt32LE(2835, 38);
	header.writeInt32LE(2835, 42);
	return Buffer.concat([header, pixelData]);
}

const previewDir = process.env.WIZARD_PREVIEW_DIR;
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
try {
	const page = await browser.newPage();
	for (const item of variants) {
		await page.setViewport({
			width: item.width,
			height: item.height,
			deviceScaleFactor: item.scale
		});
		await page.goto(`${pageUrl.href}?variant=${item.variant}`, { waitUntil: 'load' });
		await page.evaluate(() => document.fonts.ready);
		const shot = await page.screenshot({ type: 'png' });
		const bmp = toBmp(decodePng(shot));
		const target = path.join(assetsDir, item.file);
		fs.writeFileSync(target, bmp);
		console.info(
			`${item.file}: ${item.width}x${item.height} (${item.scale}x → ${item.width * item.scale}x${item.height * item.scale}), ${(bmp.length / 1024).toFixed(0)} KB`
		);
		if (previewDir) {
			if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
			fs.writeFileSync(path.join(previewDir, item.file.replace('.bmp', '.png')), Buffer.from(shot));
		}
	}
} finally {
	await browser.close();
}
