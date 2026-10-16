// Penyimpan sementara berkas yang sudah dibaca.
//
// Pratinjau dan simpan adalah dua permintaan HTTP terpisah, sedangkan unggahan
// berkas tidak bisa dikirim ulang dari peramban. Isi berkas yang sudah diparse
// ditahan sebentar di memori supaya tombol Simpan tidak perlu minta unggah ulang.
// Aman karena aplikasi ini berjalan satu proses.

import { randomBytes } from 'node:crypto';
import type { WorkbookParse } from './parse';

type Simpanan = {
	sekolahId: number;
	userId: number;
	namaBerkas: string;
	parse: WorkbookParse;
	expiresAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const MAKS = 20;

const simpanan = new Map<string, Simpanan>();

function bersihkan(now = Date.now()) {
	for (const [token, entry] of simpanan) {
		if (entry.expiresAt <= now) simpanan.delete(token);
	}
	// Batasi jumlah supaya unggahan berulang tidak menumpuk di memori.
	while (simpanan.size > MAKS) {
		const tertua = simpanan.keys().next().value;
		if (tertua == null) break;
		simpanan.delete(tertua);
	}
}

export function simpanBerkas(input: Omit<Simpanan, 'expiresAt'>): string {
	bersihkan();
	const token = randomBytes(16).toString('hex');
	simpanan.set(token, { ...input, expiresAt: Date.now() + TTL_MS });
	return token;
}

/** Ambil hanya kalau masih milik sekolah dan pengguna yang sama. */
export function ambilBerkas(token: string, sekolahId: number, userId: number): Simpanan | null {
	bersihkan();
	const entry = simpanan.get(token);
	if (!entry) return null;
	if (entry.sekolahId !== sekolahId || entry.userId !== userId) return null;
	return entry;
}

export function hapusBerkas(token: string) {
	simpanan.delete(token);
}
