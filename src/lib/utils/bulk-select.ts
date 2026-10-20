/** Pembantu untuk seleksi baris (bulk select) pada tabel. */

export function toggleId(terpilih: number[], id: number, checked: boolean): number[] {
	if (checked) return [...new Set([...terpilih, id])];
	return terpilih.filter((value) => value !== id);
}

export function selectAll(ids: number[], checked: boolean): number[] {
	return checked ? [...new Set(ids.filter((id) => Number.isFinite(id)))] : [];
}

export function semuaTerpilih(ids: number[], terpilih: number[]): boolean {
	return ids.length > 0 && ids.every((id) => terpilih.includes(Number(id)));
}

export function adaYangTerpilih(terpilih: number[]): boolean {
	return terpilih.length > 0;
}
