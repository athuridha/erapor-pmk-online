/**
 * Deteksi lingkungan Vercel (serverless) — dipakai untuk mematikan perilaku
 * yang hanya valid pada instalasi node lokal/Windows:
 *  - scheduler bel sekolah (setInterval + spawn audio),
 *  - spawn proses latar belakang (`pnpm db:push`),
 *  - penulisan file `.env` pada runtime,
 *  - data root permanen (dipindah ke /tmp yang ephemeral).
 *
 * Vercel menyetel `VERCEL=1` di build & runtime; `VERCEL_ENV` (production/
 * preview/development) ikut disetel. Deteksi ini tidak aktif pada instalasi
 * lokal biasa maupun Windows installer.
 */
export function isVercel(): boolean {
	return process.env.VERCEL === '1';
}
