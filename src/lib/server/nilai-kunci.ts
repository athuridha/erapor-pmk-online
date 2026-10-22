import { and, eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableAuthUser, tableKunciNilai } from '$lib/server/db/schema';
import { catatAudit } from '$lib/admin/audit.server';

/** Ringkasan status kunci untuk satu mata pelajaran. */
export interface InfoKunciNilai {
	mapelId: number;
	dikunciOleh: string | null;
	dikunciPada: string | null;
	alasan: string | null;
}

/**
 * Ambil status kunci nilai untuk sekumpulan mata pelajaran.
 * Kunci bersifat per mata pelajaran (ikut kelasnya), bukan per murid.
 */
export async function loadKunciNilai(mapelIds: number[]): Promise<Map<number, InfoKunciNilai>> {
	const hasil = new Map<number, InfoKunciNilai>();
	if (!mapelIds.length) return hasil;

	const rows = await db
		.select({
			mapelId: tableKunciNilai.mataPelajaranId,
			dikunciOleh: tableAuthUser.username,
			dikunciPada: tableKunciNilai.dikunciPada,
			alasan: tableKunciNilai.alasan
		})
		.from(tableKunciNilai)
		.leftJoin(tableAuthUser, eq(tableKunciNilai.dikunciOleh, tableAuthUser.id))
		.where(inArray(tableKunciNilai.mataPelajaranId, mapelIds));

	for (const row of rows) {
		hasil.set(row.mapelId, {
			mapelId: row.mapelId,
			dikunciOleh: row.dikunciOleh ?? null,
			dikunciPada: row.dikunciPada ?? null,
			alasan: row.alasan ?? null
		});
	}
	return hasil;
}

/** Kunci nilai satu mata pelajaran (idempotent). */
export async function kunciNilaiMapel(params: {
	mapelId: number;
	namaMapel: string;
	sekolahId: number;
	userId: number | null;
	aktor: string | null;
	alasan?: string | null;
}): Promise<void> {
	const timestamp = new Date().toISOString();
	await db
		.insert(tableKunciNilai)
		.values({
			sekolahId: params.sekolahId,
			mataPelajaranId: params.mapelId,
			dikunciOleh: params.userId,
			dikunciPada: timestamp,
			alasan: params.alasan?.trim() || null,
			createdAt: timestamp,
			updatedAt: timestamp
		})
		.onConflictDoUpdate({
			target: tableKunciNilai.mataPelajaranId,
			set: {
				dikunciOleh: params.userId,
				dikunciPada: timestamp,
				alasan: params.alasan?.trim() || null,
				updatedAt: timestamp
			}
		});

	await catatAudit({
		sekolahId: params.sekolahId,
		userId: params.userId,
		aktor: params.aktor,
		aksi: 'kunci_nilai',
		entitas: 'mata_pelajaran',
		entitasId: params.mapelId,
		ringkasan: `Nilai dikunci: ${params.namaMapel}`,
		detail: { alasan: params.alasan?.trim() || null }
	});
}

/** Buka kunci nilai satu mata pelajaran. */
export async function bukaKunciNilaiMapel(params: {
	mapelId: number;
	namaMapel: string;
	sekolahId: number;
	userId: number | null;
	aktor: string | null;
}): Promise<void> {
	await db
		.delete(tableKunciNilai)
		.where(
			and(
				eq(tableKunciNilai.mataPelajaranId, params.mapelId),
				eq(tableKunciNilai.sekolahId, params.sekolahId)
			)
		);

	await catatAudit({
		sekolahId: params.sekolahId,
		userId: params.userId,
		aktor: params.aktor,
		aksi: 'buka_kunci_nilai',
		entitas: 'mata_pelajaran',
		entitasId: params.mapelId,
		ringkasan: `Nilai dibuka: ${params.namaMapel}`
	});
}

/**
 * Pastikan nilai mapel boleh diubah. Dipanggil di setiap action penyimpanan
 * nilai supaya penguncian tidak bisa dilewati dari sisi server.
 */
export async function pastikanNilaiTidakTerkunci(
	mapelId: number,
	namaMapel: string
): Promise<void> {
	const kunci = await loadKunciNilai([mapelId]);
	if (!kunci.has(mapelId)) return;
	const info = kunci.get(mapelId);
	throw error(
		403,
		`Nilai ${namaMapel} sudah dikunci${info?.dikunciOleh ? ` oleh ${info.dikunciOleh}` : ''}. Hubungi operator sekolah untuk membuka kunci.`
	);
}
