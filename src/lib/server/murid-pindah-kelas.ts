import db from '$lib/server/db';
import { tableKelas, tableMurid } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { queryInChunks, runInChunks } from '$lib/server/db/chunk';

export interface HasilPindahKelas {
	message?: string;
	fail?: string;
}

/**
 * Memindahkan murid ke kelas lain pada semester yang sama.
 *
 * Dipakai oleh halaman Data Murid (/murid) dan halaman Rekap Nilai Keseluruhan
 * supaya aturan perpindahan kelas selalu sama: kelas tujuan harus milik sekolah
 * yang sama dan berada di semester yang sama dengan murid.
 */
export async function pindahkanMuridKelas(opts: {
	sekolahId: number;
	muridIds: number[];
	kelasId: number;
}): Promise<HasilPindahKelas> {
	const { sekolahId, kelasId } = opts;
	const muridIds = [...new Set(opts.muridIds)].filter((id) => Number.isInteger(id) && id > 0);

	if (!muridIds.length) {
		return { fail: 'Pilih minimal satu murid untuk dipindahkan' };
	}
	if (!Number.isInteger(kelasId) || kelasId <= 0) {
		return { fail: 'Pilih kelas tujuan' };
	}

	const kelasTujuan = await db.query.tableKelas.findFirst({
		columns: { id: true, nama: true, semesterId: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelasTujuan) {
		return { fail: 'Kelas tujuan tidak ditemukan di sekolah ini' };
	}

	const muridList = await queryInChunks(muridIds, (ids) =>
		db.query.tableMurid.findMany({
			columns: { id: true, nama: true, kelasId: true, semesterId: true },
			where: and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids))
		})
	);
	if (muridList.length !== muridIds.length) {
		return { fail: 'Sebagian murid tidak ditemukan. Muat ulang halaman lalu coba lagi.' };
	}

	const bedaSemester = muridList.filter((murid) => murid.semesterId !== kelasTujuan.semesterId);
	if (bedaSemester.length) {
		return {
			fail: `Kelas ${kelasTujuan.nama} berada di semester berbeda. Pindah kelas hanya bisa dalam semester yang sama.`
		};
	}

	const akanPindah = muridList.filter((murid) => murid.kelasId !== kelasTujuan.id);
	if (!akanPindah.length) {
		return { message: `Semua murid sudah berada di kelas ${kelasTujuan.nama}` };
	}

	await runInChunks(
		akanPindah.map((murid) => murid.id),
		(ids) =>
			db
				.update(tableMurid)
				.set({ kelasId: kelasTujuan.id, updatedAt: new Date().toISOString() })
				.where(and(eq(tableMurid.sekolahId, sekolahId), inArray(tableMurid.id, ids)))
	);

	const dilewati = muridList.length - akanPindah.length;
	return {
		message: `${akanPindah.length} murid dipindahkan ke kelas ${kelasTujuan.nama}${
			dilewati ? ` (${dilewati} sudah berada di kelas ini)` : ''
		}`
	};
}
