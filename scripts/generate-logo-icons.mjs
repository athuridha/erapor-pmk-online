// Regenerates static/logo.ico (installer icon), static/favicon.ico and static/favicon.png
// from static/logo.png. Source must be an 8-bit RGBA PNG with a transparent background.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(projectRoot, 'static', 'logo.png');
const ALPHA_CUTOFF = 8; // abaikan piksel hampir transparan saat menghitung batas konten
const MARGIN_RATIO = 0.03; // ruang kosong di tiap sisi, supaya lambang tidak menyentuh tepi ikon

function decodePng(buf) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	if (!buf.subarray(0, 8).equals(sig)) throw new Error(`${sourcePath} bukan file PNG`);
	let offset = 8;
	let header = null;
	const idat = [];
	while (offset < buf.length) {
		const length = buf.readUInt32BE(offset);
		const type = buf.toString('ascii', offset + 4, offset + 8);
		const data = buf.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') header = data;
		else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		offset += 12 + length;
	}
	if (!header) throw new Error('IHDR tidak ditemukan');
	const width = header.readUInt32BE(0);
	const height = header.readUInt32BE(4);
	const bitDepth = header[8];
	const colorType = header[9];
	const interlace = header[12];
	if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
		throw new Error(
			`PNG harus 8-bit RGBA non-interlaced (dapat bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`
		);
	}
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = width * 4;
	const rgba = Buffer.alloc(height * stride);
	let cursor = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[cursor++];
		const row = raw.subarray(cursor, cursor + stride);
		cursor += stride;
		const current = rgba.subarray(y * stride, (y + 1) * stride);
		const previous = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
		for (let i = 0; i < stride; i++) {
			const left = i >= 4 ? current[i - 4] : 0;
			const up = previous[i];
			const upLeft = i >= 4 ? previous[i - 4] : 0;
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
	return { width, height, rgba };
}

function crc32(buf) {
	let crc = 0xffffffff;
	for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function pngChunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
	const stride = width * 4;
	const filtered = Buffer.alloc(height * (stride + 1));
	for (let y = 0; y < height; y++) {
		const base = y * (stride + 1);
		filtered[base] = 1; // filter Sub: cukup baik untuk gambar lambang
		for (let i = 0; i < stride; i++) {
			const value = rgba[y * stride + i];
			const left = i >= 4 ? rgba[y * stride + i - 4] : 0;
			filtered[base + 1 + i] = (value - left) & 0xff;
		}
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', zlib.deflateSync(filtered, { level: 9 })),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

function alphaBounds({ width, height, rgba }) {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (rgba[(y * width + x) * 4 + 3] <= ALPHA_CUTOFF) continue;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}
	if (maxX < 0) throw new Error('gambar tampak kosong: tidak ada piksel yang terlihat');
	return { minX, minY, maxX, maxY };
}

// Potong ke batas konten, jadikan persegi, beri margin transparan.
function toSquareImage({ width, height, rgba }) {
	const { minX, minY, maxX, maxY } = alphaBounds({ width, height, rgba });
	const contentWidth = maxX - minX + 1;
	const contentHeight = maxY - minY + 1;
	const side = Math.max(contentWidth, contentHeight);
	const margin = Math.round(side * MARGIN_RATIO);
	const outSize = side + margin * 2;
	const out = Buffer.alloc(outSize * outSize * 4);
	const offsetX = Math.round((side - contentWidth) / 2) + margin;
	const offsetY = Math.round((side - contentHeight) / 2) + margin;
	for (let y = 0; y < contentHeight; y++) {
		const src = ((minY + y) * width + minX) * 4;
		const dst = ((offsetY + y) * outSize + offsetX) * 4;
		rgba.copy(out, dst, src, src + contentWidth * 4);
	}
	return { width: outSize, height: outSize, rgba: out };
}

// Rata-rata area (box filter) — turun skala saja, hasil halus untuk ikon.
function resize({ width, height, rgba }, target) {
	if (width === target && height === target) return rgba;
	const out = Buffer.alloc(target * target * 4);
	const scaleX = width / target;
	const scaleY = height / target;
	for (let y = 0; y < target; y++) {
		const y0 = Math.floor(y * scaleY);
		const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((y + 1) * scaleY)));
		for (let x = 0; x < target; x++) {
			const x0 = Math.floor(x * scaleX);
			const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((x + 1) * scaleX)));
			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;
			let count = 0;
			for (let sy = y0; sy < y1; sy++) {
				for (let sx = x0; sx < x1; sx++) {
					const p = (sy * width + sx) * 4;
					const alpha = rgba[p + 3];
					r += rgba[p] * alpha;
					g += rgba[p + 1] * alpha;
					b += rgba[p + 2] * alpha;
					a += alpha;
					count++;
				}
			}
			const d = (y * target + x) * 4;
			if (a > 0) {
				out[d] = Math.round(r / a);
				out[d + 1] = Math.round(g / a);
				out[d + 2] = Math.round(b / a);
				out[d + 3] = Math.round(a / count);
			}
		}
	}
	return out;
}

// Entri ICO berisi BMP 32-bit (paling kompatibel, termasuk untuk Inno Setup).
function dibEntry(size, rgba) {
	const header = Buffer.alloc(40);
	header.writeUInt32LE(40, 0);
	header.writeInt32LE(size, 4);
	header.writeInt32LE(size * 2, 8);
	header.writeUInt16LE(1, 12);
	header.writeUInt16LE(32, 14);
	header.writeUInt32LE(size * size * 4, 20);
	const pixels = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++) {
		const sourceRow = size - 1 - y;
		for (let x = 0; x < size; x++) {
			const s = (sourceRow * size + x) * 4;
			const d = (y * size + x) * 4;
			pixels[d] = rgba[s + 2];
			pixels[d + 1] = rgba[s + 1];
			pixels[d + 2] = rgba[s];
			pixels[d + 3] = rgba[s + 3];
		}
	}
	const maskStride = Math.ceil(size / 32) * 4;
	const mask = Buffer.alloc(maskStride * size);
	return Buffer.concat([header, pixels, mask]);
}

function buildIco(entries) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(entries.length, 4);
	const directory = Buffer.alloc(entries.length * 16);
	const payloads = [];
	let offset = 6 + entries.length * 16;
	for (let i = 0; i < entries.length; i++) {
		const { size, data } = entries[i];
		const o = i * 16;
		directory[o] = size >= 256 ? 0 : size;
		directory[o + 1] = size >= 256 ? 0 : size;
		directory.writeUInt16LE(1, o + 4);
		directory.writeUInt16LE(32, o + 6);
		directory.writeUInt32LE(data.length, o + 8);
		directory.writeUInt32LE(offset, o + 12);
		offset += data.length;
		payloads.push(data);
	}
	return Buffer.concat([header, directory, ...payloads]);
}

function main() {
	const source = decodePng(fs.readFileSync(sourcePath));
	const square = toSquareImage(source);
	console.info(
		`Sumber ${source.width}x${source.height} → dipotong & dipersegi ${square.width}x${square.height}`
	);

	const staticDir = path.join(projectRoot, 'static');
	const targets = [
		{ file: 'logo.ico', icoSizes: [16, 24, 32, 48, 64, 128, 256] },
		{ file: 'favicon.ico', icoSizes: [16, 32, 48] }
	];
	for (const { file, icoSizes } of targets) {
		const ico = buildIco(
			icoSizes.map((size) => ({ size, data: dibEntry(size, resize(square, size)) }))
		);
		fs.writeFileSync(path.join(staticDir, file), ico);
		console.info(`${file}: ${icoSizes.join('/')} px, ${(ico.length / 1024).toFixed(0)} KB`);
	}

	const faviconPng = encodePng(192, 192, resize(square, 192));
	fs.writeFileSync(path.join(staticDir, 'favicon.png'), faviconPng);
	console.info(`favicon.png: 192x192, ${(faviconPng.length / 1024).toFixed(0)} KB`);
}

main();
