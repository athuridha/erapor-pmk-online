/**
 * Susun daftar nomor halaman untuk tabel: 1 2 3 4 ... 10
 *
 * Selalu tampilkan halaman pertama, halaman terakhir, dan halaman sekitar
 * halaman aktif. Sisanya diganti tanda elipsis.
 */
export function buildPageNumbers(
	current: number,
	total: number,
	maksimal = 7
): Array<number | '…'> {
	if (total <= 1) return [1];

	const halaman = new Set<number>([1, total]);
	const rentang = Math.max(1, Math.floor((maksimal - 3) / 2));
	for (let i = current - rentang; i <= current + rentang; i += 1) {
		if (i >= 1 && i <= total) halaman.add(i);
	}

	const daftar = [...halaman].sort((a, b) => a - b);
	const hasil: Array<number | '…'> = [];
	let sebelumnya = 0;
	for (const nomor of daftar) {
		if (sebelumnya && nomor - sebelumnya > 1) hasil.push('…');
		hasil.push(nomor);
		sebelumnya = nomor;
	}
	return hasil;
}

/** Ukuran halaman yang diizinkan untuk daftar tabel. */
export const OPSI_BARIS_PER_HALAMAN = [50, 100, 200] as const;

export function normalisasiBarisPerHalaman(
	nilai: string | null | undefined,
	defaultNilai = 50
): number {
	const angka = Number(nilai);
	if (!Number.isInteger(angka)) return defaultNilai;
	if (!OPSI_BARIS_PER_HALAMAN.includes(angka as (typeof OPSI_BARIS_PER_HALAMAN)[number])) {
		return defaultNilai;
	}
	return angka;
}
