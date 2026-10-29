/**
 * Cloudflare D1 menolak statement dengan lebih dari 100 bound parameter
 * ("D1_ERROR: too many SQL variables"). Query `inArray` yang id-nya bisa
 * berjumlah ratusan (mis. seluruh murid satu sekolah) harus dipecah.
 */
export const D1_MAX_BOUND_PARAMS = 100;

/** Sisakan ruang untuk parameter lain di statement yang sama. */
export const IN_CHUNK_SIZE = 90;

export function chunk<T>(items: readonly T[], size = IN_CHUNK_SIZE): T[][] {
	if (size <= 0) throw new Error('chunk size must be positive');
	const parts: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		parts.push(items.slice(i, i + size));
	}
	return parts;
}

/**
 * Jalankan query per potongan id lalu gabungkan hasilnya.
 *
 * Untuk filter dua dimensi (`and(inArray(a), inArray(b))`) cukup potong daftar
 * yang besar dan saring dimensi lain di memori, supaya jumlah parameter tetap
 * di bawah batas dan index tetap terpakai.
 */
export async function queryInChunks<T, R>(
	items: readonly T[],
	run: (part: T[]) => Promise<R[]>
): Promise<R[]> {
	const rows: R[] = [];
	for (const part of chunk(items)) {
		rows.push(...(await run(part)));
	}
	return rows;
}

/** Versi `queryInChunks` untuk operasi tulis/hapus yang juga kena batas parameter. */
export async function runInChunks<T>(
	items: readonly T[],
	run: (part: T[]) => Promise<unknown>
): Promise<void> {
	for (const part of chunk(items)) {
		await run(part);
	}
}
