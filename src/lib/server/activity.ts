/**
 * Pelacak aktivitas aplikasi (server-side).
 *
 * Dipakai mesin auto update untuk deciding "aplikasi sedang menganggur" —
 * syarat sebelum installer dijalankan otomatis. Semua request yang masuk
 * menandai aktivitas, sehingga idle berarti tidak ada guru/kepala sekolah yang
 * sedang memakai aplikasi.
 */

let lastActivityAt = Date.now();

/** Tandai bahwa ada request yang baru saja dilayani. */
export function markActivity() {
	lastActivityAt = Date.now();
}

/** Waktu idle terakhir (ms). 0 berarti ada request baru saja. */
export function getIdleMs() {
	return Date.now() - lastActivityAt;
}

/** Timestamp aktivitas terakhir (epoch ms). */
export function getLastActivityAt() {
	return lastActivityAt;
}
