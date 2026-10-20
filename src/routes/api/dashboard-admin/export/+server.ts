import { buildRekapKeseluruhan } from '$lib/server/rekap-keseluruhan';
import { rekapKeExcel } from '$lib/server/rekap-export';
import { error } from '@sveltejs/kit';

export async function GET({ locals, url }) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw error(401, 'Sekolah tidak ditemukan');
	}
	const user = locals.user;
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Dashboard ini khusus admin dan kepala sekolah.');
	}

	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	const kelasId = Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : null;
	const filterMapel = url.searchParams.get('mapel')?.trim() || null;
	const paramPengampu = Number(url.searchParams.get('pengampu_id') ?? '');
	const pengampuId = Number.isInteger(paramPengampu) && paramPengampu > 0 ? paramPengampu : null;

	const rekap = await buildRekapKeseluruhan(sekolahId, { kelasId, filterMapel, pengampuId });
	const buffer = await rekapKeExcel(rekap, 'Dashboard Admin - Rekap Nilai Keseluruhan');
	const namaFile =
		`Dashboard Admin Rekap Nilai${kelasId ? ` ${rekap.kelas.nama}` : ''}.xlsx`.replace(
			/[\\/:*?"<>|]/g,
			'-'
		);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${namaFile}"`
		}
	});
}
