/**
 * Aset bawaan (static/) yang dibaca server saat runtime — di-inline lewat
 * `?inline` (data URI base64 oleh Vite) supaya ikut ter-bundle ke dalam
 * serverless function Vercel (filesystem app di sana read-only dan folder
 * `static/` tidak ikut ke dalam function).
 *
 * Pada build lokal/adapter-node perilaku identik: nilai tetap data URI yang
 * sama, hanya sumbernya dari bundle alih-alih readFileSync.
 */
import tutwuriBwPng from '../../../static/tutwuri-bw.png?inline';
import logoPng from '../../../static/logo.png?inline';
import logoKumerPng from '../../../static/logo-kumer.png?inline';
import bgCertificatePng from '../../../static/bg-certificate.png?inline';
import bgCertificate2Png from '../../../static/bg-certificate2.png?inline';
import garudaPancasilaPng from '../../../static/garudaPancasila.png?inline';
import ebGaramondWoff2 from '../../../static/fonts/EBGaramond.woff2?inline';
import ebGaramondItalicWoff2 from '../../../static/fonts/EBGaramond-Italic.woff2?inline';
import playfairDisplayWoff2 from '../../../static/fonts/PlayfairDisplay.woff2?inline';
import playfairDisplayItalicWoff2 from '../../../static/fonts/PlayfairDisplay-Italic.woff2?inline';

/** Watermark tut wuri handayani (hitam-putih) sebagai data URI. */
export const tutwuriBwDataUri = tutwuriBwPng;
/** Logo sekolah bawaan (`static/logo.png`) sebagai data URI. */
export const tutwuriLogoDataUri = logoPng;
/** Logo Kurikulum Merdeka sebagai data URI. */
export const kumerLogoDataUri = logoKumerPng;
export const bgCertificateDataUri = bgCertificatePng;
export const bgCertificate2DataUri = bgCertificate2Png;
/** Logo Garuda Pancasila (placeholder logo dinas) sebagai data URI. */
export const garudaPancasilaDataUri = garudaPancasilaPng;

/** Font piagam (EB Garamond + Playfair Display) sebagai data URI, per nama file. */
export const piagamFontDataUris: Record<string, string> = {
	'EBGaramond.woff2': ebGaramondWoff2,
	'EBGaramond-Italic.woff2': ebGaramondItalicWoff2,
	'PlayfairDisplay.woff2': playfairDisplayWoff2,
	'PlayfairDisplay-Italic.woff2': playfairDisplayItalicWoff2
};

/** Data URI base64 → Uint8Array (untuk disimpan sebagai blob di DB). */
export function dataUriBytes(dataUri: string): Uint8Array {
	const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
	const buf = Buffer.from(base64, 'base64');
	return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
