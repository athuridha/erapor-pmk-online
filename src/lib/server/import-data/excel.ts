// exceljs adalah modul CommonJS, jadi `import { Workbook } from 'exceljs'` lolos di
// pemeriksaan tipe tetapi gagal saat SSR (Vite menolak named export dari CJS).
// Modul ini jadi satu-satunya jalan memuat exceljs, mengikuti pola yang sudah
// dipakai di `src/lib/excel/template.ts`.

import type { Workbook } from 'exceljs';

export type PembuatWorkbook = new () => Workbook;

export async function muatWorkbook(): Promise<PembuatWorkbook> {
	const mod = (await import('exceljs')) as unknown as {
		default?: { Workbook?: PembuatWorkbook };
		Workbook?: PembuatWorkbook;
	};
	const WorkbookCtor = mod.default?.Workbook ?? mod.Workbook;
	if (!WorkbookCtor) throw new Error('exceljs tidak bisa dimuat');
	return WorkbookCtor;
}
