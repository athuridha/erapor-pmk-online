import { ownedKelasIdSet } from '../kelas-akses';
import { isAdminUser } from '../../../routes/pengguna/permissions';

/**
 * True bila `user` boleh mengedit/menghapus data kehadiran (trigger presensi).
 * Model baru: guru merangkap wali kelas disimpan sebagai type 'user', jadi
 * status wali dicek dari relasi waliKelasId — bukan hanya dari tipe akun.
 * `kelasId` opsional: bila diketahui kelas datanya, cek dilakukan per kelas;
 * bila tidak, cukup akun itu wali dari minimal satu kelas.
 */
export async function canUserEditAbsen(
	user: NonNullable<App.Locals['user']>,
	_sekolahId: number,
	kelasId?: number | null
): Promise<boolean> {
	if (isAdminUser(user)) return true;
	// Akun wali kelas lama: akses penuh (perilaku sebelum refactor dipertahankan).
	if (user.type === 'wali_kelas') return true;
	if (user.type === 'user') {
		const owned = user.pegawaiId ? await ownedKelasIdSet(user) : new Set<number>();
		if (kelasId != null) {
			return owned.has(kelasId) || user.kelasId === kelasId;
		}
		return owned.size > 0;
	}
	return false;
}

export function isTableMissingError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes('no such table') &&
		(error.message.includes('ketidakhadiran_harian') ||
			error.message.includes('ketidakhadiran_rapor') ||
			error.message.includes('absensi'))
	);
}

export const TABLE_MISSING_MESSAGE =
	'Tabel yang diperlukan belum tersedia. Jalankan "pnpm db:push" untuk menerapkan migrasi terbaru.';

export function todayDateString() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function isValidDate(s: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const [y, m, d] = s.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function getDaysInMonth(year: number, month: number) {
	return new Date(year, month, 0).getDate();
}

export function dateStr(year: number, month: number, day: number) {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Convert an ISO timestamp (absensi.waktu) to the LOCAL YYYY-MM-DD date.
 * `waktu.slice(0, 10)` extracts the UTC date which is off by one day for
 * timezones ahead of UTC (e.g. WIB) whenever the instant falls before local
 * midnight offset — use this instead so records land on the intended day.
 */
export function waktuToLocalDate(waktu: string) {
	const d = new Date(waktu);
	if (Number.isNaN(d.getTime())) return waktu.slice(0, 10);
	return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
