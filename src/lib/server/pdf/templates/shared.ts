import { tutwuriBwDataUri } from '../../bundled-assets';

export function getTutwuriBwDataUri(): string {
	// Di-inline lewat bundle (bundled-assets) — bebas filesystem saat runtime.
	return tutwuriBwDataUri;
}

export function sharedStyles(): string {
	return `
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

@page {
	size: A4 portrait;
	margin: 20mm;
}

html, body {
	height: 100%;
}

body {
	font-family: Helvetica, Arial, sans-serif;
	font-size: 12pt;
	color: #000;
	line-height: 1.4;
}

.page-break {
	page-break-before: always;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.font-bold { font-weight: bold; }
.font-normal { font-weight: normal; }
.uppercase { text-transform: uppercase; }

table {
	border-collapse: collapse;
	width: 100%;
}

.watermark {
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	opacity: 0.12;
	width: 45%;
	pointer-events: none;
	z-index: -1;
}

@media print {
	.watermark { position: fixed; }
}
`;
}

export const FALLBACK = '\u2014';

export interface CustomCetakDoc {
	judul: string;
	subjudul: string;
	kopBaris1: string;
	kopBaris2: string;
	catatan: string;
	tampilkanFoto: boolean;
	tampilkanLogo: boolean;
	tampilkanWatermark: boolean;
	labelMengetahui: string;
}

/**
 * Ambil pengaturan kustomisasi cetak yang menempel di data cetak.
 * Semua field opsional: template lama tetap aman kalau data tidak memuatnya.
 */
export function customDoc(data: unknown): CustomCetakDoc {
	const raw = (data as { custom?: Record<string, unknown> } | null)?.custom ?? {};
	const teks = (raw.teks ?? {}) as { labelMengetahui?: string };
	return {
		judul: typeof raw.judul === 'string' ? raw.judul : '',
		subjudul: typeof raw.subjudul === 'string' ? raw.subjudul : '',
		kopBaris1: typeof raw.kopBaris1 === 'string' ? raw.kopBaris1 : '',
		kopBaris2: typeof raw.kopBaris2 === 'string' ? raw.kopBaris2 : '',
		catatan: typeof raw.catatan === 'string' ? raw.catatan : '',
		tampilkanFoto: raw.tampilkanFoto !== false,
		tampilkanLogo: raw.tampilkanLogo !== false,
		tampilkanWatermark: raw.tampilkanWatermark !== false,
		labelMengetahui: teks.labelMengetahui || 'Mengetahui'
	};
}

// Escape a string for safe interpolation into an HTML template. Used before any
// user-supplied text is placed into a template's text node or a double-quoted
// attribute, preventing stored-HTML injection.
export function escHtml(val: string | number | null | undefined): string {
	if (val === null || val === undefined) return '';
	return String(val)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function formatValue(val: string | number | null | undefined): string {
	if (val === null || val === undefined || val === '') return FALLBACK;
	return escHtml(val);
}

export function formatUpper(val: string | null | undefined): string {
	if (val === null || val === undefined || val === '') return FALLBACK;
	// Uppercase the raw value first, then escape, so HTML entities like ``&amp;``
	// are not uppercased into ``&AMP;``.
	return escHtml(String(val).toUpperCase());
}
