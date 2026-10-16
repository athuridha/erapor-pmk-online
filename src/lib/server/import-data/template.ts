// Pembuat template impor. Kolom, contoh, dan aturan diambil dari `sheets.ts`
// supaya template tidak pernah menyimpang dari yang dibaca oleh parser.

import type { Worksheet } from 'exceljs';
import { muatWorkbook } from './excel';
import { AGAMA_JENIS_MAPEL, SHEETS, SHEET_ORDER } from './sheets';

// Kolom identitas ditulis sebagai teks di Excel, supaya NIS/NIP berawalan nol
// tidak berubah jadi angka atau notasi ilmiah.
const KOLOM_TEKS = ['nis', 'nisn', 'nip', 'nuptk', 'wali_kelas_nip', 'pengampu_nip'];

// Jumlah baris yang disiapkan formatnya; pengguna bisa menambah sendiri.
const BARIS_DISIAPKAN = 500;

export async function buatTemplateBuffer(): Promise<Buffer> {
	const Workbook = await muatWorkbook();
	const wb = new Workbook();
	wb.creator = 'e-Rapor SMK Pratama Mulya';
	wb.title = 'Template Impor Data Pokok';

	const petunjuk = wb.addWorksheet('Petunjuk');
	siapkanPetunjuk(petunjuk);

	for (const key of SHEET_ORDER) {
		const spec = SHEETS[key];
		const ws = wb.addWorksheet(spec.sheet);

		spec.kolom.forEach((kolom, i) => {
			const cell = ws.getRow(1).getCell(i + 1);
			cell.value = `${kolom.label}${kolom.wajib ? ' *' : ''}`;
			cell.font = { bold: true };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
			ws.getColumn(i + 1).width = kolom.lebar ?? 18;
		});
		ws.views = [{ state: 'frozen', ySplit: 1 }];

		const kolomTeks = spec.kolom
			.map((kolom, i) => ({ kolom, kolom1: i + 1 }))
			.filter(({ kolom }) => KOLOM_TEKS.includes(kolom.key));
		const kolomPilihan =
			spec.key === 'murid'
				? { key: 'jenis_kelamin', daftar: '"L,P"' }
				: spec.key === 'mapel'
					? { key: 'jenis', daftar: `"${AGAMA_JENIS_MAPEL.join(',')}"` }
					: null;
		const posisiPilihan = kolomPilihan
			? spec.kolom.findIndex((kolom) => kolom.key === kolomPilihan.key) + 1
			: 0;

		for (let r = 2; r <= BARIS_DISIAPKAN; r += 1) {
			const row = ws.getRow(r);
			for (const { kolom1 } of kolomTeks) row.getCell(kolom1).numFmt = '@';
			if (kolomPilihan && posisiPilihan > 0) {
				row.getCell(posisiPilihan).dataValidation = {
					type: 'list',
					allowBlank: true,
					formulae: [kolomPilihan.daftar]
				};
			}
		}
	}

	const buffer = await wb.xlsx.writeBuffer();
	return Buffer.from(buffer as ArrayBuffer);
}

function siapkanPetunjuk(ws: Worksheet) {
	ws.getColumn(1).width = 26;
	ws.getColumn(2).width = 10;
	ws.getColumn(3).width = 24;
	ws.getColumn(4).width = 64;

	const judul = (teks: string, size = 12) => {
		const row = ws.addRow([teks]);
		row.getCell(1).font = { bold: true, size };
	};

	judul('Template Impor Data Pokok', 14);
	ws.addRow([
		'Isi sheet Guru, Kelas, Murid, dan/atau Mapel. Hanya sheet yang ada di berkas ini yang diproses.'
	]);
	ws.addRow(['Judul kolom bertanda * wajib diisi. Baris kosong diabaikan.']);
	ws.addRow([
		'Data dicocokkan dengan data yang sudah ada: yang cocok diperbarui, yang baru ditambahkan.'
	]);
	ws.addRow([]);

	for (const key of SHEET_ORDER) {
		const spec = SHEETS[key];
		judul(`Sheet: ${spec.sheet} (${spec.judul})`);
		ws.addRow([spec.ringkas]);
		ws.addRow([`Dicocokkan lewat ${spec.kunci}.`]);

		const head = ws.addRow(['Kolom', 'Wajib', 'Contoh', 'Keterangan']);
		for (let c = 1; c <= 4; c += 1) head.getCell(c).font = { bold: true };

		for (const kolom of spec.kolom) {
			ws.addRow([kolom.label, kolom.wajib ? 'ya' : '', kolom.contoh, kolom.petunjuk ?? '']);
		}
		ws.addRow([]);
	}

	judul('Cara pakai', 13);
	ws.addRow(['1. Isi salah satu sheet saja, atau beberapa sekaligus dalam satu berkas.']);
	ws.addRow(['2. Simpan sebagai .xlsx.']);
	ws.addRow(['3. Buka halaman Sekolah lalu pilih Impor Data Pokok, unggah berkasnya.']);
	ws.addRow([
		'4. Periksa pratinjau: baris yang gagal beserta alasannya ditampilkan sebelum disimpan.'
	]);
	ws.addRow(['5. Tekan Simpan setelah pratinjau sesuai.']);
}
