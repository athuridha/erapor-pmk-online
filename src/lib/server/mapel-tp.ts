import db from '$lib/server/db';
import {
	tableMataPelajaran,
	tableTujuanPembelajaran,
	tableKelas,
	tableAsesmenFormatif,
	tableAsesmenSumatifTujuan,
	tableJurnalMengajar
} from '$lib/server/db/schema';
import { and, asc, count, eq, inArray, ne } from 'drizzle-orm';
import { getAksesMapelUser } from '$lib/server/mapel-access';

export type MapelKelasDiampu = {
	mapelId: number;
	kelasId: number;
	kelasNama: string;
	tpCount: number;
};

/**
 * Mencari seluruh kelas lain yang diampu oleh guru (atau tersedia untuk admin)
 * yang memiliki mata pelajaran yang sama (nama sama).
 */
export async function getKelasDiampuLainForMapel(
	mapelId: number,
	user:
		| {
				id?: number;
				type?: string;
				pegawaiId?: number | null;
				mataPelajaranId?: number | null;
		  }
		| null
		| undefined,
	sekolahId?: number | null
): Promise<MapelKelasDiampu[]> {
	const current = await db.query.tableMataPelajaran.findFirst({
		where: eq(tableMataPelajaran.id, mapelId),
		columns: { id: true, nama: true, kelasId: true, kategori: true }
	});
	if (!current || !current.nama) return [];

	const normalizedCurrentNama = current.nama.trim().toLowerCase();

	// Ambil semua mapel intrakurikuler lain di sekolah yang sama
	const otherMapels = await db
		.select({
			id: tableMataPelajaran.id,
			nama: tableMataPelajaran.nama,
			kelasId: tableMataPelajaran.kelasId,
			pengampuId: tableMataPelajaran.pengampuId,
			kelasNama: tableKelas.nama
		})
		.from(tableMataPelajaran)
		.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
		.where(
			and(
				ne(tableMataPelajaran.id, current.id),
				eq(tableMataPelajaran.kategori, 'intrakurikuler'),
				sekolahId ? eq(tableKelas.sekolahId, sekolahId) : undefined
			)
		);

	// Filter yang namanya sama
	const sameNameMapels = otherMapels.filter(
		(m) => (m.nama ?? '').trim().toLowerCase() === normalizedCurrentNama
	);
	if (!sameNameMapels.length) return [];

	// Filter hak akses guru jika bukan admin/kepala sekolah
	let allowedMapels = sameNameMapels;
	const isTeacher = user && user.type !== 'admin' && user.type !== 'kepala_sekolah';
	if (isTeacher && user.id) {
		const akses = await getAksesMapelUser({
			id: user.id,
			pegawaiId: user.pegawaiId,
			mataPelajaranId: user.mataPelajaranId
		});
		allowedMapels = sameNameMapels.filter(
			(m) =>
				akses.ids.has(m.id) ||
				(m.pengampuId != null && user.pegawaiId != null && m.pengampuId === user.pegawaiId)
		);
	}

	if (!allowedMapels.length) return [];

	// Hitung TP yang sudah ada pada masing-masing mapel tujuan
	const mapelIds = allowedMapels.map((m) => m.id);
	const tpCounts = await db
		.select({
			mapelId: tableTujuanPembelajaran.mataPelajaranId,
			total: count()
		})
		.from(tableTujuanPembelajaran)
		.where(inArray(tableTujuanPembelajaran.mataPelajaranId, mapelIds))
		.groupBy(tableTujuanPembelajaran.mataPelajaranId);

	const tpCountMap = new Map<number, number>();
	for (const row of tpCounts) {
		tpCountMap.set(row.mapelId, Number(row.total));
	}

	return allowedMapels.map((m) => ({
		mapelId: m.id,
		kelasId: m.kelasId,
		kelasNama: m.kelasNama,
		tpCount: tpCountMap.get(m.id) ?? 0
	}));
}

/**
 * Menyalin/mensinkronkan seluruh Tujuan Pembelajaran dari satu mapel sumber
 * ke satu atau beberapa mapel tujuan.
 */
export async function syncTujuanPembelajaran({
	sourceMapelId,
	targetMapelIds,
	mode = 'replace'
}: {
	sourceMapelId: number;
	targetMapelIds: number[];
	mode?: 'replace' | 'merge';
}): Promise<{
	success: boolean;
	syncedKelasCount: number;
	tpCount: number;
	message: string;
}> {
	if (!targetMapelIds.length) {
		return {
			success: false,
			syncedKelasCount: 0,
			tpCount: 0,
			message: 'Pilih minimal satu kelas tujuan.'
		};
	}

	const sourceTPs = await db.query.tableTujuanPembelajaran.findMany({
		where: eq(tableTujuanPembelajaran.mataPelajaranId, sourceMapelId),
		orderBy: [asc(tableTujuanPembelajaran.id)]
	});

	if (!sourceTPs.length) {
		return {
			success: false,
			syncedKelasCount: 0,
			tpCount: 0,
			message: 'Tidak ada tujuan pembelajaran di kelas sumber untuk disinkronkan.'
		};
	}

	let syncedCount = 0;

	await db.transaction(async (tx) => {
		for (const targetId of targetMapelIds) {
			const existingTargetTPs = await tx.query.tableTujuanPembelajaran.findMany({
				where: eq(tableTujuanPembelajaran.mataPelajaranId, targetId)
			});

			const targetByKey = new Map<string, (typeof existingTargetTPs)[number]>();
			for (const t of existingTargetTPs) {
				const key = `${t.lingkupMateri.trim().toLowerCase()}::${t.deskripsi.trim().toLowerCase()}`;
				targetByKey.set(key, t);
			}

			// Ambil ID TP yang sudah terpakai di penilaian agar tidak dihapus sembarangan
			const existingTargetIds = existingTargetTPs.map((t) => t.id);
			const usedTpIds = new Set<number>();
			if (existingTargetIds.length > 0) {
				const [fmtList, sumList, jrnList] = await Promise.all([
					tx
						.select({ id: tableAsesmenFormatif.tujuanPembelajaranId })
						.from(tableAsesmenFormatif)
						.where(inArray(tableAsesmenFormatif.tujuanPembelajaranId, existingTargetIds)),
					tx
						.select({ id: tableAsesmenSumatifTujuan.tujuanPembelajaranId })
						.from(tableAsesmenSumatifTujuan)
						.where(inArray(tableAsesmenSumatifTujuan.tujuanPembelajaranId, existingTargetIds)),
					tx
						.select({ id: tableJurnalMengajar.tujuanPembelajaranId })
						.from(tableJurnalMengajar)
						.where(inArray(tableJurnalMengajar.tujuanPembelajaranId, existingTargetIds))
				]);
				for (const r of fmtList) if (r.id) usedTpIds.add(r.id);
				for (const r of sumList) if (r.id) usedTpIds.add(r.id);
				for (const r of jrnList) if (r.id) usedTpIds.add(r.id);
			}

			const matchedTargetIds = new Set<number>();
			const toInsert: Array<{
				mataPelajaranId: number;
				lingkupMateri: string;
				deskripsi: string;
				bobot: number;
				teknikPenilaianId: number | null;
			}> = [];

			for (const src of sourceTPs) {
				const key = `${src.lingkupMateri.trim().toLowerCase()}::${src.deskripsi.trim().toLowerCase()}`;
				const existing = targetByKey.get(key);
				if (existing) {
					matchedTargetIds.add(existing.id);
					// Perbarui bobot dan teknik penilaian agar sinkron
					if (
						existing.bobot !== src.bobot ||
						existing.teknikPenilaianId !== src.teknikPenilaianId ||
						existing.lingkupMateri !== src.lingkupMateri ||
						existing.deskripsi !== src.deskripsi
					) {
						await tx
							.update(tableTujuanPembelajaran)
							.set({
								bobot: src.bobot,
								teknikPenilaianId: src.teknikPenilaianId,
								lingkupMateri: src.lingkupMateri,
								deskripsi: src.deskripsi
							})
							.where(eq(tableTujuanPembelajaran.id, existing.id));
					}
				} else {
					toInsert.push({
						mataPelajaranId: targetId,
						lingkupMateri: src.lingkupMateri,
						deskripsi: src.deskripsi,
						bobot: src.bobot,
						teknikPenilaianId: src.teknikPenilaianId
					});
				}
			}

			if (toInsert.length > 0) {
				await tx.insert(tableTujuanPembelajaran).values(toInsert);
			}

			// Pada mode replace, hapus TP lama di target yang tidak ada di sumber (selama belum dipakai nilai)
			if (mode === 'replace') {
				const toDeleteIds = existingTargetTPs
					.filter((t) => !matchedTargetIds.has(t.id) && !usedTpIds.has(t.id))
					.map((t) => t.id);
				if (toDeleteIds.length > 0) {
					await tx
						.delete(tableTujuanPembelajaran)
						.where(inArray(tableTujuanPembelajaran.id, toDeleteIds));
				}
			}

			syncedCount++;
		}
	});

	return {
		success: true,
		syncedKelasCount: syncedCount,
		tpCount: sourceTPs.length,
		message: `Berhasil mensinkronkan ${sourceTPs.length} Tujuan Pembelajaran ke ${syncedCount} kelas tujuan.`
	};
}
