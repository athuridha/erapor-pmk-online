import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableAuthUser,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { and, count, eq, sql } from 'drizzle-orm';

export interface HasilHapus {
	message?: string;
	fail?: string;
}

/**
 * Hapus satu baris data dari modul admin.
 *
 * Penghapusan dicegah bila data masih dipakai modul lain (mis. kelas yang
 * masih punya murid, mapel yang sudah punya nilai, akun admin terakhir), supaya
 * tidak merusak data lain secara diam-diam.
 */
export async function hapusDataModul(
	sekolahId: number,
	key: string,
	id: number,
	opts: { userId?: number } = {}
): Promise<HasilHapus> {
	if (!Number.isInteger(id) || id <= 0) {
		return { fail: 'Data tidak valid.' };
	}

	switch (key) {
		case 'kelas': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableMurid)
				.where(eq(tableMurid.kelasId, id));
			if (n > 0) {
				return { fail: `Kelas masih memiliki ${n} murid. Pindahkan muridnya lebih dulu.` };
			}
			const [{ n: nMapel } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableMataPelajaran)
				.where(eq(tableMataPelajaran.kelasId, id));
			if (nMapel > 0) {
				return {
					fail: `Kelas masih memiliki ${nMapel} mata pelajaran. Hapus mapelnya lebih dulu.`
				};
			}
			await db
				.delete(tableKelas)
				.where(and(eq(tableKelas.id, id), eq(tableKelas.sekolahId, sekolahId)));
			return { message: 'Kelas dihapus.' };
		}
		case 'murid': {
			await db
				.delete(tableMurid)
				.where(and(eq(tableMurid.id, id), eq(tableMurid.sekolahId, sekolahId)));
			return { message: 'Murid dihapus beserta nilai dan absensinya.' };
		}
		case 'intrakurikuler': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableAsesmenSumatif)
				.where(eq(tableAsesmenSumatif.mataPelajaranId, id));
			if (n > 0) {
				return { fail: `Mata pelajaran sudah memiliki ${n} nilai. Hapus nilainya lebih dulu.` };
			}
			await db
				.delete(tableMataPelajaran)
				.where(
					and(
						eq(tableMataPelajaran.id, id),
						eq(
							tableMataPelajaran.kelasId,
							sql`(select id from kelas where sekolah_id = ${sekolahId})`
						)
					)
				);
			return { message: 'Mata pelajaran dihapus.' };
		}
		case 'pengguna': {
			const akun = await db.query.tableAuthUser.findFirst({
				columns: { id: true, type: true, username: true },
				where: eq(tableAuthUser.id, id)
			});
			if (!akun) return { fail: 'Akun tidak ditemukan.' };
			if (akun.type === 'admin') {
				return { fail: 'Akun bertipe admin tidak bisa dihapus dari sini.' };
			}
			if (opts.userId && akun.id === opts.userId) {
				return { fail: 'Akun yang sedang dipakai tidak bisa dihapus.' };
			}
			await db.delete(tableAuthUser).where(eq(tableAuthUser.id, id));
			return { message: `Akun ${akun.username} dihapus.` };
		}
		case 'tahun_ajaran': {
			const [{ n } = { n: 0 }] = await db
				.select({ n: count() })
				.from(tableKelas)
				.where(eq(tableKelas.tahunAjaranId, id));
			if (n > 0) {
				return { fail: `Tahun ajaran masih memiliki ${n} kelas. Hapus kelasnya lebih dulu.` };
			}
			await db
				.delete(tableTahunAjaran)
				.where(and(eq(tableTahunAjaran.id, id), eq(tableTahunAjaran.sekolahId, sekolahId)));
			return { message: 'Tahun ajaran dihapus.' };
		}
		default:
			return { fail: 'Modul ini belum mendukung penghapusan dari dashboard.' };
	}
}
