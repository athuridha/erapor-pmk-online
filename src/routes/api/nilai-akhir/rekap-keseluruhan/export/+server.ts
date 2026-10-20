import { buildRekapKeseluruhan } from '$lib/server/rekap-keseluruhan';
import { rekapKeExcel } from '$lib/server/rekap-export';
import { canAccessKelas } from '$lib/server/kelas-akses';
import { cookieNames } from '$lib/utils.js';
import { isAuthorizedUser } from '../../../../pengguna/permissions';
import { error } from '@sveltejs/kit';

export async function GET({ cookies, locals, url }) {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw error(401, 'Sekolah tidak ditemukan');
	}
	if (!locals.user) {
		throw error(401, 'Sesi tidak valid. Silakan login ulang.');
	}
	if (!isAuthorizedUser(['administrasi_rekap_nilai'], locals.user)) {
		throw error(403, 'Anda tidak memiliki izin untuk mengunduh rekap nilai.');
	}

	const paramKelasId = Number(url.searchParams.get('kelas_id') ?? '');
	const cookieKelasId = Number(cookies.get(cookieNames.ACTIVE_KELAS_ID) || '');
	const kelasAktifId =
		Number.isInteger(paramKelasId) && paramKelasId > 0 ? paramKelasId : cookieKelasId;
	if (!kelasAktifId) {
		throw error(400, 'Pilih kelas aktif terlebih dahulu');
	}
	if (!(await canAccessKelas(locals.user, sekolahId, kelasAktifId))) {
		throw error(403, 'Anda tidak memiliki akses ke kelas ini.');
	}

	const filterMapel = url.searchParams.get('mapel')?.trim() || null;
	const paramPengampu = Number(url.searchParams.get('pengampu_id') ?? '');
	const pengampuId = Number.isInteger(paramPengampu) && paramPengampu > 0 ? paramPengampu : null;

	const rekap = await buildRekapKeseluruhan(sekolahId, {
		kelasId: kelasAktifId,
		filterMapel,
		pengampuId
	});

	const buffer = await rekapKeExcel(rekap, 'Rekap Nilai Keseluruhan');
	const namaFile = `Rekap Nilai Keseluruhan ${rekap.kelas.nama}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${namaFile}"`
		}
	});
}
