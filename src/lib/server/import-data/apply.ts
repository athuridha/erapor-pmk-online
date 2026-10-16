// Eksekutor impor. Seluruh penulisan berjalan dalam satu transaksi supaya berkas
// yang gagal di tengah jalan tidak meninggalkan data separuh jadi.

import db from '$lib/server/db/index.js';
import type { Rencana } from './plan';

export type HasilImpor = {
	dibuat: number;
	diubah: number;
	gagal: number;
	pesan: string[];
};

export async function jalankanImpor(rencana: Rencana): Promise<HasilImpor> {
	let dibuat = 0;
	let diubah = 0;
	const pesan: string[] = [];

	await db.transaction(async (tx) => {
		for (const baris of rencana.baris) {
			if (!baris.jalankan) continue;
			try {
				await baris.jalankan(tx);
				if (baris.aksi === 'baru') dibuat += 1;
				else diubah += 1;
			} catch (e) {
				// Satu baris gagal tidak boleh membatalkan baris lain; penyebabnya
				// dilaporkan supaya bisa dibetulkan di berkas sumber.
				pesan.push(`Baris ${baris.no} (${baris.kunci}): ${(e as Error).message}`);
			}
		}
	});

	return { dibuat, diubah, gagal: pesan.length, pesan };
}
