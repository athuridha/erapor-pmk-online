import { sharedStyles, FALLBACK, escHtml, formatValue, formatUpper } from './shared';

export type P5Rating = 'BB' | 'MB' | 'BSH' | 'BSB';

/** Keterangan kode rating P5 (Profil Pelajar Pancasila). */
const RATING_LABEL: Record<P5Rating, string> = {
	BB: 'Belum Berkembang',
	MB: 'Mulai Berkembang',
	BSH: 'Berkembang Sesuai Harapan',
	BSB: 'Berkembang Sangat Baik'
};

export interface RaporP5PrintData {
	sekolah: {
		nama: string;
		alamat: string;
		kopLines: string[];
	};
	murid: {
		nama: string;
		nisn: string;
		kelas: string;
	};
	projek: Array<{
		tema: string;
		judul: string;
		pembina: string;
		catatan: string;
		dimensi: Array<{
			dimensi: string;
			rating: P5Rating;
			catatan: string;
		}>;
	}>;
	ttd: {
		tempat: string;
		tanggal: string;
	};
	kepalaSekolah: {
		nama: string;
		nip?: string | null;
		statusKepalaSekolah?: string | null;
		/** Tanda tangan kepala sekolah (diunggah di /tanda-tangan). */
		tandaTangan?: string | null;
	};
	/** Guru pembina tiap projek yang diikuti murid (tanpa duplikat). */
	pembina: Array<{
		nama: string;
		nip?: string | null;
		tandaTangan?: string | null;
	}>;
}

function kopHTML(sekolah: RaporP5PrintData['sekolah']): string {
	const line = escHtml(sekolah.alamat);
	const kopL = sekolah.kopLines
		.map((kop) => `<div class="kop-line">${escHtml(kop)}</div>`)
		.join('');
	return `
	<div class="kop">
		${kopL}
		<div class="kop-school">${formatUpper(sekolah.nama)}</div>
		${line ? `<div class="kop-alamat">${line}</div>` : ''}
	</div>
	<div class="double-line"></div>`;
}

function identitasHTML(murid: RaporP5PrintData['murid']): string {
	return `
	<table class="identitas">
		<tr>
			<td class="label">Nama</td>
			<td class="label">No. NISN</td>
			<td class="label">Kelas</td>
		</tr>
		<tr>
			<td class="value">${formatValue(murid.nama)}</td>
			<td class="value">${formatValue(murid.nisn)}</td>
			<td class="value">${formatValue(murid.kelas)}</td>
		</tr>
	</table>`;
}

function projekHTML(projek: RaporP5PrintData['projek'][number]): string {
	const rows = projek.dimensi
		.map(
			(d, i) => `
			<tr>
				<td class="text-center">${i + 1}</td>
				<td>${formatValue(d.dimensi)}</td>
				<td class="text-center">${formatValue(d.rating)}</td>
				<td>${escHtml(RATING_LABEL[d.rating] ?? FALLBACK)}${d.catatan ? `<div class="dim-note">${escHtml(d.catatan)}</div>` : ''}</td>
			</tr>`
		)
		.join('');

	return `
	<div class="projek">
		<div class="projek-heading">TEMA: ${formatUpper(projek.tema)} &mdash; JUDUL: ${escHtml(projek.judul)}</div>
		<div class="projek-sub">Pembina: ${formatValue(projek.pembina)}</div>
		<table class="p5-table">
			<thead>
				<tr>
					<th style="width: 6%;">No.</th>
					<th style="width: 44%;">Dimensi</th>
					<th style="width: 10%;">Rating</th>
					<th style="width: 40%;">Keterangan</th>
				</tr>
			</thead>
			<tbody>
				${rows || '<tr><td colspan="4" class="text-center" style="padding:10px;">Belum ada penilaian dimensi</td></tr>'}
			</tbody>
		</table>
		${projek.catatan ? `<div class="projek-catatan"><span class="label">Deskripsi:</span> ${escHtml(projek.catatan)}</div>` : ''}
	</div>`;
}

function ttdImg(urls: (string | null | undefined)[]): string {
	return urls
		.filter((src): src is string => Boolean(src))
		.map((src) => `<img class="ttd-img" src="${src}" alt="" />`)
		.join('');
}

function pengesahanHTML(data: RaporP5PrintData): string {
	const kepalaLabel =
		data.kepalaSekolah.statusKepalaSekolah === 'plt' ? 'Plt. Kepala Sekolah' : 'Kepala Sekolah';
	const pembinaColumns =
		data.pembina.length > 0
			? data.pembina
					.map(
						(p) => `
			<div class="ttd-block">
				<div class="ttd-role">Guru Pembina</div>
				<div class="ttd-sign">${ttdImg([p.tandaTangan])}</div>
				<div class="ttd-name">${formatValue(p.nama)}</div>
				<div class="ttd-nip">${escHtml(p.nip ?? '')}</div>
			</div>`
					)
					.join('')
			: '';
	return `
	<div class="pengesahan">
		<div class="pengesahan-text">Pengesahan Laporan Hasil Projek Penguatan Profil Pelajar Pancasila (P5)</div>
		<div class="pengesahan-flex">
			<div class="ttd-block">
				<div class="ttd-role">${data.ttd.tempat}, ${formatValue(data.ttd.tanggal)}</div>
				<div class="ttd-role">${kepalaLabel}</div>
				<div class="ttd-sign">${ttdImg([data.kepalaSekolah.tandaTangan])}</div>
				<div class="ttd-name">${formatValue(data.kepalaSekolah.nama)}</div>
				<div class="ttd-nip">${escHtml(data.kepalaSekolah.nip ?? '')}</div>
			</div>
			${pembinaColumns}
		</div>
	</div>`;
}

/**
 * Render HTML Laporan Hasil Projek P5 (satu seksi per murid, page-break antar
 * murid). A4 portrait.
 */
export function renderRaporP5HTML(items: RaporP5PrintData[]): string {
	const sections = items
		.map(
			(data, idx) => `
	<section class="murid-page${idx > 0 ? ' page-break' : ''}">
		${kopHTML(data.sekolah)}
		<h1 class="doc-title">LAPORAN HASIL PROJEK PENGUATAN PROFIL PELAJAR PANCASILA (P5)</h1>
		${identitasHTML(data.murid)}
		${data.projek.length ? data.projek.map(projekHTML).join('') : '<p class="empty">Murid belum mengikuti projek P5 pada periode ini.</p>'}
		${pengesahanHTML(data)}
		<div class="footer-note">Dicetak dari e-Rapor SMK Pratama Mulya</div>
	</section>`
		)
		.join('');

	return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
${sharedStyles()}

.asm-page {
	font-family: Helvetica, Arial, sans-serif;
}

.kop {
	text-align: center;
}

.kop-line {
	font-weight: bold;
	font-size: 11pt;
	line-height: 1.3;
}

.kop-school {
	font-weight: bold;
	font-size: 14pt;
	line-height: 1.3;
}

.kop-alamat {
	font-size: 9pt;
	font-style: italic;
}

.double-line {
	border-top: 2px solid #000;
	border-bottom: 1px solid #000;
	height: 0;
	margin: 1mm 0 4mm;
}

.doc-title {
	font-size: 13pt;
	font-weight: bold;
	text-align: center;
	margin: 2mm 0 4mm;
}

.identitas {
	width: 100%;
	border: none;
	font-size: 11pt;
	margin-bottom: 4mm;
}

.identitas td {
	border: none;
	vertical-align: top;
}

.identitas .label {
	font-weight: bold;
	width: 33%;
	border-bottom: 1px solid #000;
	padding-bottom: 1px;
}

.identitas .value {
	padding-top: 1px;
	padding-bottom: 2mm;
}

.projek {
	margin-bottom: 6mm;
}

.projek-heading {
	font-weight: bold;
	font-size: 11pt;
	margin-bottom: 1mm;
}

.projek-sub {
	font-style: italic;
	font-size: 10pt;
	margin-bottom: 2mm;
}

.p5-table {
	font-size: 10pt;
}

.p5-table,
.p5-table th,
.p5-table td {
	border: 1px solid #333;
}

.p5-table th {
	background-color: #e0e0e0;
	font-weight: bold;
	text-align: center;
	padding: 4px;
}

.p5-table td {
	padding: 4px;
	vertical-align: top;
}

.dim-note {
	font-size: 9pt;
	font-style: italic;
	color: #333;
	margin-top: 2px;
}

.projek-catatan {
	margin-top: 2mm;
	font-size: 10pt;
}

.projek-catatan .label {
	font-weight: bold;
}

.empty {
	text-align: center;
	font-style: italic;
	margin: 6mm 0;
}

.pengesahan {
	margin-top: 10mm;
	page-break-inside: avoid;
}

.pengesahan-text {
	font-size: 11pt;
	margin-bottom: 3mm;
}

.pengesahan-flex {
	display: flex;
	justify-content: space-between;
	gap: 8mm;
}

.ttd-block {
	text-align: center;
	min-width: 40mm;
}

.ttd-role {
	font-size: 11pt;
}

.ttd-sign {
	height: 18mm;
	margin: 1mm 0;
}

.ttd-img {
	height: 16mm;
	max-width: 40mm;
	object-fit: contain;
}

.ttd-name {
	font-weight: bold;
	text-decoration: underline;
	font-size: 11pt;
}

.ttd-nip {
	font-size: 11pt;
}

.footer-note {
	margin-top: 10mm;
	text-align: center;
	font-size: 8.5pt;
	color: #555;
	border-top: 1px solid #ccc;
	padding-top: 2mm;
}
</style>
</head>
<body>
${sections}
</body>
</html>`;
}
