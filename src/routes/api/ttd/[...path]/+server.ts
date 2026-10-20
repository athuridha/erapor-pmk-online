import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personSignatureDataUrl, readSignatureFile } from '$lib/server/ttd';

const PERSON_REL = /^pegawai\/(\d+)\.png$/;

export const GET: RequestHandler = async ({ locals, params }) => {
	const rel = params.path ?? '';

	// Guru & pegawai signatures are staff data; only logged-in users may view them.
	// Tamu signatures are fine to serve publicly (the /tamu page itself is public).
	if ((rel.startsWith('guru/') || rel.startsWith('pegawai/')) && !locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Tanda tangan kepala sekolah/wali kelas/guru disimpan di database; berkas
	// lama (kalau masih ada) tetap dilayani di bawah.
	const person = PERSON_REL.exec(rel);
	if (person) {
		const dataUrl = await personSignatureDataUrl(Number(person[1]));
		if (dataUrl?.startsWith('data:image/')) {
			const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
			const buf = Buffer.from(base64, 'base64');
			if (buf.length) {
				return new Response(new Uint8Array(buf), {
					headers: {
						'Content-Type': 'image/png',
						// Nama berkas tetap, jadi jangan di-cache selamanya: tanda
						// tangan bisa diganti kapan saja dari halaman /tanda-tangan.
						'Cache-Control': 'no-cache',
						'X-Content-Type-Options': 'nosniff'
					}
				});
			}
		}
	}

	const buf = await readSignatureFile(rel);
	if (!buf) throw error(404, 'Not found');

	return new Response(new Uint8Array(buf), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
