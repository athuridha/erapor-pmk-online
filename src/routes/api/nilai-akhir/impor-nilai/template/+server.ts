import { buatTemplateNilai, type JenisImpor } from '$lib/admin/impor-nilai.server';
import { error } from '@sveltejs/kit';

export async function GET({ locals, url }) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw error(401, 'Sekolah tidak ditemukan.');
	}
	const kelasId = Number(url.searchParams.get('kelas_id') ?? 0);
	const jenis = (
		url.searchParams.get('jenis') === 'formatif' ? 'formatif' : 'sumatif'
	) as JenisImpor;
	if (!kelasId) {
		throw error(400, 'Pilih kelas terlebih dahulu.');
	}

	try {
		const { buffer, namaFile } = await buatTemplateNilai(sekolahId, kelasId, jenis);
		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${encodeURIComponent(namaFile)}"`
			}
		});
	} catch (gagal) {
		throw error(400, gagal instanceof Error ? gagal.message : 'Gagal membuat template nilai.');
	}
}
