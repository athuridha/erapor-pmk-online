// Pembaca berkas impor: satu workbook → baris per sheet, sudah dinormalkan jadi teks.
//
// Tidak memakai `$lib/utils/excel.ts` karena pembaca itu hanya melayani sheet pertama,
// sedangkan berkas ini bisa memuat empat sheet sekaligus.

import type { Cell } from 'exceljs';
import { muatWorkbook } from './excel';
import { SHEET_ORDER, normalKolom, sheetByNama, type SheetKey } from './sheets';

export type NilaiBaris = Record<string, string>;
export type BarisSheet = { no: number; nilai: NilaiBaris };
export type SheetParse = {
	key: SheetKey;
	nama: string;
	baris: BarisSheet[];
	// Masalah tingkat sheet (mis. kolom wajib tidak ada). Selama tidak kosong,
	// sheet ini tidak boleh diproses.
	galat: string[];
};
export type WorkbookParse = { sheets: SheetParse[]; galat: string[] };

/** ExcelJS bisa mengembalikan teks kaya, hasil rumus, atau tanggal. Semuanya jadi teks. */
function selKeTeks(cell: Cell): string {
	const value: unknown = cell.value;
	if (value == null) return '';
	if (value instanceof Date) return tanggalIso(value) ?? '';
	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		if (Array.isArray(obj.richText)) {
			return (obj.richText as { text?: string }[])
				.map((part) => part.text ?? '')
				.join('')
				.trim();
		}
		if (typeof obj.text === 'string') return obj.text.trim();
		if ('result' in obj) {
			const result = obj.result;
			if (result instanceof Date) return tanggalIso(result) ?? '';
			return result == null ? '' : String(result).trim();
		}
		if ('hyperlink' in obj) return String(cell.text ?? '').trim();
	}
	if (typeof value === 'number') return String(value);
	return String(value).trim();
}

function tanggalIso(date: Date): string | null {
	if (Number.isNaN(date.getTime())) return null;
	const iso = date.toISOString().slice(0, 10);
	return iso;
}

/** Ubah nilai sel jadi teks datar; angka bulat ditulis tanpa pemisah ribuan. */
function teks(value: string | number | undefined): string {
	if (value == null) return '';
	return String(value).trim();
}

/** Terima YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, dan serial tanggal Excel. */
export function keTanggalIso(input: string): string | null {
	const nilai = input.trim();
	if (!nilai) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return nilai;

	const pisah = nilai.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
	if (pisah) {
		const [, d, m, y] = pisah;
		const bulan = Number(m);
		const hari = Number(d);
		if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}

	if (/^\d+(\.\d+)?$/.test(nilai)) {
		const serial = Number(nilai);
		// Rentang akal untuk tanggal modern (1970-2100).
		if (serial >= 25569 && serial <= 73415) {
			const ms = Math.round((serial - 25569) * 86400 * 1000);
			return new Date(ms).toISOString().slice(0, 10);
		}
	}
	return null;
}

/** Terima L/P dengan berbagai penulisan umum. */
export function keJenisKelamin(input: string): 'L' | 'P' | null {
	const nilai = normalKolom(input);
	if (!nilai) return null;
	if (nilai === 'l' || nilai.startsWith('lak') || nilai === 'male' || nilai === 'm') return 'L';
	if (nilai === 'p' || nilai.startsWith('per') || nilai === 'female' || nilai === 'f') return 'P';
	return null;
}

export async function bacaWorkbook(buffer: Buffer): Promise<WorkbookParse> {
	const Workbook = await muatWorkbook();
	const wb = new Workbook();
	await wb.xlsx.load(buffer);

	const hasil: SheetParse[] = [];
	const galat: string[] = [];

	for (const key of SHEET_ORDER) {
		// Cari worksheet yang namanya cocok dengan sheet mana pun yang dikenal,
		// lalu pasangkan ke spec-nya. Nama sheet tidak harus persis.
		const sheet = wb.worksheets.find((ws) => sheetByNama(ws.name)?.key === key);
		if (!sheet) continue;

		const spec = sheetByNama(sheet.name);
		if (!spec) continue;

		// Baris 1 dianggap judul kolom. Peta: kunci internal → nomor kolom.
		const header = sheet.getRow(1);
		const petaKolom = new Map<string, number>();
		const kolomAda = new Set<string>();
		for (let col = 1; col <= sheet.columnCount; col += 1) {
			const judul = selKeTeks(header.getCell(col));
			if (!judul) continue;
			kolomAda.add(normalKolom(judul));
			const cocok = spec.kolom.find(
				(k) =>
					normalKolom(k.label) === normalKolom(judul) || normalKolom(k.key) === normalKolom(judul)
			);
			if (cocok && !petaKolom.has(cocok.key)) petaKolom.set(cocok.key, col);
		}

		const galatSheet: string[] = [];
		if (petaKolom.size === 0) {
			galatSheet.push(
				`Sheet "${spec.sheet}": baris pertama harus berisi judul kolom (${spec.kolom
					.map((k) => k.label)
					.join(', ')}).`
			);
		} else {
			const kurang = spec.kolom.filter((k) => k.wajib && !petaKolom.has(k.key));
			if (kurang.length) {
				galatSheet.push(
					`Sheet "${spec.sheet}": kolom wajib belum ada → ${kurang.map((k) => k.label).join(', ')}.`
				);
			}
		}

		const baris: BarisSheet[] = [];
		if (galatSheet.length === 0) {
			for (let r = 2; r <= sheet.rowCount; r += 1) {
				const row = sheet.getRow(r);
				const nilai: NilaiBaris = {};
				let adaIsi = false;
				for (const [key, col] of petaKolom) {
					const isi = teks(selKeTeks(row.getCell(col)));
					nilai[key] = isi;
					if (isi) adaIsi = true;
				}
				if (adaIsi) baris.push({ no: r, nilai });
			}
		}

		hasil.push({ key, nama: spec.sheet, baris, galat: galatSheet });
	}

	if (hasil.length === 0) {
		galat.push(
			`Tidak ada sheet yang dikenali. Nama sheet yang diterima: ${SHEET_ORDER.map(
				(k) => sheetByNama(k) ?? k
			).join(', ')}.`
		);
	}

	return { sheets: hasil, galat };
}
