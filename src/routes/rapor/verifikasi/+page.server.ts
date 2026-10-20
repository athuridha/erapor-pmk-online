import { bacaTokenRapor } from '$lib/server/rapor-qr';
import type { PageServerLoad } from './$types';

/**
 * Halaman verifikasi rapor (publik).
 *
 * Dipakai orang tua/wali yang memindai QR code pada rapor. Token berisi payload
 * rapor yang ditandatangani HMAC, jadi keaslian bisa dipastikan tanpa membuka
 * database sekolah.
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	const payload = bacaTokenRapor(token);

	return {
		meta: { title: 'Verifikasi Rapor' },
		valid: Boolean(payload),
		payload: payload ?? null
	};
};
