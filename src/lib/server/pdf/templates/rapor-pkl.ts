import { getKopSuratLines } from '$lib/statics';
import { sharedStyles, escHtml, formatValue, formatUpper } from './shared';

export interface RaporPklSekolahInfo {
	nama: string;
	jenjang: 'sd' | 'smp' | 'sma' | 'slb' | 'pkbm' | 'srt';
	jenjangVariant?: string | null;
	naungan?: 'kemendikbud' | 'kemsos' | 'kemenag' | null;
	npsn: string;
	alamat: {
		jalan: string;
		desa: string;
		kecamatan: string;
		kabupaten: string;
		provinsi?: string | null;
		kodePos?: string | null;
	};
	website?: string | null;
	email?: string | null;
	logoUrl?: string | null;
	logoDinasUrl?: string | null;
}

export interface RaporPklHalaman {
	murid: { nama: string; nisn?: string | null; kelas?: string | null };
	nilai: Array<{
		urutan: number | null;
		deskripsi: string;
		nilai: string | null;
		predikat: string | null;
	}>;
	catatan?: string | null;
	ttdNama: {
		pembimbingPerusahaan?: string | null;
		guruPembimbing?: string | null;
		kepalaSekolah?: string | null;
	};
	/** Signature images are data URLs from the people-signature storage. */
	ttdImg: { guruPembimbing?: string | null; kepalaSekolah?: string | null };
}

export interface RaporPklPrintData {
	sekolah: RaporPklSekolahInfo;
	judul: string;
	subjudul: string;
	kelompokNama?: string | null;
	skPenugasan?: string | null;
	guruPembimbing?: string | null;
	tempatPkl: {
		nama: string;
		alamat?: string | null;
		lokasi?: string | null;
		pembimbing?: string | null;
	};
	periode: string;
	tempat: string;
	tanggal: string;
	halaman: RaporPklHalaman[];
}

function getJenjangLabel(jenjang: string | null): string {
	switch (jenjang) {
		case 'sd':
			return 'SEKOLAH DASAR';
		case 'smp':
			return 'SEKOLAH MENENGAH PERTAMA';
		case 'sma':
			return 'SEKOLAH MENENGAH ATAS';
		default:
			return 'SEKOLAH';
	}
}

function schoolHeading(jenjang: string | null, nama: string): string {
	const label = getJenjangLabel(jenjang);
	const upper = nama.toUpperCase().trim();
	const words = label.split(' ').slice(1).join(' ');
	return words && upper.includes(words) ? upper : `${label} ${upper}`;
}

function pklStyles(): string {
	return `
@page {
	size: A4 portrait;
	margin: 14mm 16mm;
}

.pkl-page {
	display: flex;
	flex-direction: column;
	min-height: 261mm;
	font-size: 11pt;
}

.pkl-page + .pkl-page {
	page-break-before: always;
}

.header {
	display: flex;
	align-items: center;
	gap: 4mm;
	margin-bottom: 2mm;
}

.header-logo {
	width: 18mm;
	height: 18mm;
	object-fit: contain;
	flex-shrink: 0;
}

.header-center {
	flex: 1;
	text-align: center;
}

.header-text {
	font-weight: bold;
	font-size: 11pt;
}

.header-text-14 {
	font-weight: bold;
	font-size: 14pt;
}

.header-info {
	font-size: 9pt;
	font-style: italic;
}

.header-contact {
	font-size: 8pt;
	font-style: italic;
}

.double-line {
	border-top: 2px solid #000;
	border-bottom: 1px solid #000;
	height: 0;
	margin: 1mm 0 4mm;
}

.judul {
	text-align: center;
	font-weight: bold;
	font-size: 14pt;
	text-transform: uppercase;
}

.subjudul {
	text-align: center;
	font-size: 12pt;
	margin-bottom: 6mm;
}

.blok {
	margin-bottom: 4mm;
}

.blok-judul {
	font-weight: bold;
	text-decoration: underline;
	margin-bottom: 1mm;
}

.identitas,
.tempat-pkl {
	width: 100%;
	border-collapse: collapse;
	font-size: 11pt;
}

.identitas td,
.tempat-pkl td {
	padding: 0.5mm 2mm;
	vertical-align: top;
}

.identitas td:first-child,
.tempat-pkl td:first-child {
	width: 34mm;
	padding-left: 0;
}

table.nilai-tabel {
	border: 1px solid #000;
	font-size: 10.5pt;
}

table.nilai-tabel th,
table.nilai-tabel td {
	border: 1px solid #000;
	padding: 1.5mm 2mm;
	vertical-align: top;
}

table.nilai-tabel th {
	background-color: #e8e8e8;
	font-weight: bold;
	text-align: center;
}

table.nilai-tabel td.center {
	text-align: center;
}

.blok-catatan {
	margin: 4mm 0;
	text-align: justify;
}

.ttd-grid {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 4mm;
	margin-top: 10mm;
}

.ttd-col {
	text-align: center;
}

.ttd-label {
	font-size: 11pt;
}

.ttd-spasi {
	height: 18mm;
}

.ttd-img {
	height: 16mm;
	max-width: 45mm;
	object-fit: contain;
	vertical-align: middle;
	margin-bottom: 1mm;
}

.ttd-nama {
	font-weight: bold;
	text-decoration: underline;
}

.doc-footnote {
	margin-top: auto;
	font-size: 8pt;
	color: #666;
}

.doc-footnote summary {
	cursor: pointer;
	color: #999;
}
`;
}

function kopHTML(data: RaporPklPrintData): string {
	const sekolah = data.sekolah;

	const alamatParts = [
		sekolah.alamat.jalan,
		sekolah.alamat.desa,
		sekolah.alamat.kecamatan,
		sekolah.alamat.kabupaten
	].filter(Boolean);
	const alamatLine = escHtml(alamatParts.join(', '));

	const contactParts: string[] = [`NPSN: ${sekolah.npsn}`];
	if (sekolah.website) contactParts.push(`Website: ${sekolah.website}`);
	if (sekolah.email) contactParts.push(`Email: ${sekolah.email}`);
	const contactLine = escHtml(contactParts.join(' | '));

	const kopBawaan = getKopSuratLines({
		jenjangVariant: sekolah.jenjangVariant,
		naungan: sekolah.naungan,
		kabupaten: sekolah.alamat.kabupaten,
		provinsi: sekolah.alamat.provinsi
	});
	const kopLines = kopBawaan.map((line) => escHtml(line));

	return `
	<div class="header">
		${sekolah.logoDinasUrl ? `<img src="${sekolah.logoDinasUrl}" alt="" class="header-logo">` : '<div class="header-logo"></div>'}
		<div class="header-center">
			${kopLines.map((line) => `<div class="header-text">${line}</div>`).join('')}
			<div class="header-text-14">${escHtml(schoolHeading(sekolah.jenjang, sekolah.nama))}</div>
			${alamatLine ? `<div class="header-info">${alamatLine}</div>` : ''}
			${contactLine ? `<div class="header-contact">${contactLine}</div>` : ''}
		</div>
		${sekolah.logoUrl ? `<img src="${sekolah.logoUrl}" alt="" class="header-logo">` : '<div class="header-logo"></div>'}
	</div>

	<div class="double-line"></div>`;
}

function identitasHTML(halaman: RaporPklHalaman): string {
	const { murid } = halaman;
	return `
	<div class="blok">
		<table class="identitas">
			<tr><td>Nama Murid</td><td> : ${formatUpper(murid.nama)}</td></tr>
			<tr><td>NISN</td><td> : ${formatValue(murid.nisn ?? '')}</td></tr>
			<tr><td>Kelas</td><td> : ${formatValue(murid.kelas ?? '')}</td></tr>
		</table>
	</div>`;
}

function tempatPklHTML(data: RaporPklPrintData): string {
	const tempat = data.tempatPkl;
	const baris: Array<[string, string]> = [
		['Nama Perusahaan / Instansi', formatValue(tempat.nama)],
		['Alamat / Lokasi', formatValue(tempat.lokasi || tempat.alamat || '')],
		['Pembimbing Perusahaan', formatValue(tempat.pembimbing ?? '')],
		['Guru Pembimbing', formatValue(data.guruPembimbing ?? '')],
		['Periode', escHtml(data.periode)]
	];
	if (data.skPenugasan) baris.push(['No. SK Penugasan', formatValue(data.skPenugasan)]);

	return `
	<div class="blok">
		<div class="blok-judul">Tempat Praktik Kerja Lapangan</div>
		<table class="tempat-pkl">
			${baris.map(([label, nilai]) => `<tr><td>${label}</td><td> : ${nilai}</td></tr>`).join('')}
		</table>
	</div>`;
}

function tabelNilaiHTML(halaman: RaporPklHalaman): string {
	const rows = halaman.nilai.length
		? halaman.nilai
				.map(
					(row) => `
			<tr>
				<td class="center">${row.urutan ?? '\u2014'}</td>
				<td>${escHtml(row.deskripsi)}</td>
				<td class="center">${row.nilai ? escHtml(row.nilai) : '\u2014'}</td>
				<td class="center">${formatValue(row.predikat ?? '')}</td>
			</tr>`
				)
				.join('')
		: `<tr><td colspan="4" class="center">Belum ada data nilai.</td></tr>`;

	return `
	<div class="blok">
		<div class="blok-judul">Hasil Penilaian</div>
		<table class="nilai-tabel">
			<thead>
				<tr>
					<th style="width: 10mm">No</th>
					<th>Tujuan Pembelajaran</th>
					<th style="width: 22mm">Nilai</th>
					<th style="width: 32mm">Predikat</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	</div>
	<div class="blok-catatan">Catatan: ${formatValue(halaman.catatan ?? '')}</div>`;
}

function ttdHTML(data: RaporPklPrintData, halaman: RaporPklHalaman): string {
	const { ttdNama, ttdImg } = halaman;
	return `
	<div class="ttd-grid">
		<div class="ttd-col">
			<div class="ttd-label">Pembimbing Perusahaan</div>
			<div class="ttd-spasi"></div>
			<div class="ttd-nama">${formatValue(ttdNama.pembimbingPerusahaan ?? '')}</div>
		</div>
		<div class="ttd-col">
			<div class="ttd-label">Guru Pembimbing</div>
			${ttdImg.guruPembimbing ? `<img class="ttd-img" src="${ttdImg.guruPembimbing}" alt="" />` : '<div class="ttd-spasi"></div>'}
			<div class="ttd-nama">${formatValue(ttdNama.guruPembimbing ?? '')}</div>
		</div>
		<div class="ttd-col">
			<div class="ttd-label">Kepala Sekolah</div>
			${ttdImg.kepalaSekolah ? `<img class="ttd-img" src="${ttdImg.kepalaSekolah}" alt="" />` : '<div class="ttd-spasi"></div>'}
			<div class="ttd-nama">${formatValue(ttdNama.kepalaSekolah ?? '')}</div>
		</div>
	</div>
	<div style="margin-top: 6mm; text-align: center; font-size: 10pt">${escHtml(data.tempat)}, ${escHtml(data.tanggal)}</div>`;
}

/**
 * Render PKL report HTML (A4 portrait) — one page per murid.
 * Static template targeted at PKL; not wired into the custom-doc registry.
 */
export function buildRaporPklHtml(data: RaporPklPrintData): string {
	const halaman = data.halaman ?? [];
	const subjudul = escHtml(data.kelompokNama || '');

	const halamanHTML = halaman
		.map(
			(item) => `
<section class="pkl-page">
${kopHTML(data)}
	<div class="judul">${formatUpper(data.judul)}</div>
	${subjudul ? `<div class="subjudul">Kelompok: ${subjudul}</div>` : ''}
	${identitasHTML(item)}
	${tempatPklHTML(data)}
	${tabelNilaiHTML(item)}
	${ttdHTML(data, item)}
	<details class="doc-footnote"><summary>Informasi</summary>Dicetak dari e-Rapor Pratama Mulya</details>
</section>`
		)
		.join('\n');

	return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
${sharedStyles()}
${pklStyles()}
</style>
</head>
<body>
${halamanHTML}
</body>
</html>`;
}
