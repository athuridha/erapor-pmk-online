import { createHmac, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

/**
 * QR verifikasi untuk rapor.
 *
 * Setiap rapor memuat QR code yang berisi tautan verifikasi bertanda tangan.
 * Payload (nama, kelas, semester, ...) disandikan HMAC-SHA256, jadi halaman
 * verifikasi bisa memastikan keaslian rapor tanpa perlu membuka database
 * sekolah.
 *
 * Format token: `<base64url(payload-json)>.<base64url(hmac)>`.
 */

const SALT = process.env.ERAPOR_QR_SALT || 'erapor-pmk-rapor-qr-v1';

export interface RaporQrPayload {
	nama: string;
	kelas: string;
	fase?: string | null;
	semester: string;
	tahunAjaran: string;
	periode?: string | null;
	sekolah: string;
	tanggal: string;
}

function sign(data: string): string {
	return createHmac('sha256', SALT).update(data).digest('base64url');
}

/** Buat token bertanda tangan untuk payload rapor. */
export function buatTokenRapor(payload: RaporQrPayload): string {
	const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${data}.${sign(data)}`;
}

/** Baca & verifikasi token. Mengembalikan null bila tidak valid. */
export function bacaTokenRapor(token: string | null | undefined): RaporQrPayload | null {
	if (!token) return null;
	const separator = token.lastIndexOf('.');
	if (separator <= 0) return null;

	const data = token.slice(0, separator);
	const signature = token.slice(separator + 1);
	const expected = sign(data);

	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

	try {
		const json = Buffer.from(data, 'base64url').toString('utf8');
		const parsed = JSON.parse(json) as RaporQrPayload;
		if (!parsed || typeof parsed.nama !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

/** QR code sebagai data URI PNG (dipakai di template PDF). */
export async function buatQrDataUri(url: string, size = 320): Promise<string> {
	return QRCode.toDataURL(url, {
		margin: 1,
		width: size,
		errorCorrectionLevel: 'M',
		color: { dark: '#000000ff', light: '#ffffffff' }
	});
}
