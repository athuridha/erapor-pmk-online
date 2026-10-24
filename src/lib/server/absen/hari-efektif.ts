import db from '$lib/server/db';
import { tableKelasPresensi } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/** Default active-day mask: Monday–Saturday on, Sunday off. */
export const KELAS_PRESENSI_DEFAULT = '1,1,1,1,1,1,0';

/** Fixed 7-entry day-flag tuple, indexed SENIN (0) .. MINGGU (6). */
export type HariAktifFlags = [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

export interface KelasPresensiConfig {
	hariAktif: string;
	jamMasuk: string | null;
	jamPulang: string | null;
}

/**
 * Load per-class presensi config keyed by kelasId. The table is created by
 * ensure-ekspansi-modul on startup; if it is not available yet (fresh DB,
 * migration failed) return an empty map so callers fall back to defaults.
 */
export async function loadKelasPresensi(
	sekolahId: number
): Promise<Record<number, KelasPresensiConfig>> {
	try {
		const rows = await db.query.tableKelasPresensi.findMany({
			where: eq(tableKelasPresensi.sekolahId, sekolahId)
		});
		const map: Record<number, KelasPresensiConfig> = {};
		for (const row of rows) {
			map[row.kelasId] = {
				hariAktif: row.hariAktif,
				jamMasuk: row.jamMasuk,
				jamPulang: row.jamPulang
			};
		}
		return map;
	} catch {
		return {};
	}
}

/**
 * True when the given date is an active school day. `hariAktif` is a
 * comma-mask indexed from SENIN (0) to MINGGU (6), e.g. '1,1,1,1,1,1,0'.
 * Missing/malformed value counts as active.
 */
export function isHariAktif(hariAktif: string | null | undefined, date: Date): boolean {
	if (!hariAktif) return true;
	const index = (date.getDay() + 6) % 7;
	const flags = hariAktif.split(',');
	return flags[index] !== '0';
}

/**
 * Parse the SENIN..MINGGU day mask into a fixed 7-entry boolean array.
 * Missing entries and empty input default to [true,true,true,true,true,true,false].
 */
export function parseHariAktif(hariAktif: string | null | undefined): HariAktifFlags {
	const flags = hariAktif ? hariAktif.split(',') : [];
	const valueFor = (i: number) => Boolean(flags[i] ?? '1');
	const result = Array.from({ length: 7 }, (_, i) => valueFor(i)) as HariAktifFlags;
	// Empty input: Senin–Sabtu aktif, Minggu libur.
	if (!hariAktif) result[6] = false;
	return result;
}

/** Encode a 7-entry boolean array (Senin..Minggu) back into the mask string. */
export function encodeHariAktif(flags: HariAktifFlags): string {
	return flags.map((f) => (f ? '1' : '0')).join(',');
}
