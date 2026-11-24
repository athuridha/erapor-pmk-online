import { redirect } from '@sveltejs/kit';

/**
 * Halaman ceklis Asesmen Formatif lama sudah digabung ke halaman Penilaian terpadu
 * (/asesmen-sumatif) dengan kelompok Formatif (F), Sumatif (S), Sumatif AS (AS),
 * AKHIR, dan REVISI dalam satu matriks.
 */
export async function load({ url }) {
	const params = new URLSearchParams();
	const kelas = url.searchParams.get('kelas');
	const mapelId = url.searchParams.get('mapel_id');
	if (kelas) params.set('kelas', kelas);
	if (mapelId) params.set('mapel_id', mapelId);
	const qs = params.toString();
	throw redirect(302, `/asesmen-sumatif${qs ? `?${qs}` : ''}`);
}
