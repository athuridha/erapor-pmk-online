import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { getRingkasanKelas } from '$lib/server/statistik-kelas';
import { redirect } from '@sveltejs/kit';
import { isAuthorizedUser } from '../pengguna/permissions';
import type { PageServerLoad } from './$types';

/**
 * Ringkasan satu semester. `totalMapel` = jumlah baris mapel/kelas (sama
 * dengan angka yang tampil di tabel "Mapel" per kelas), bukan jumlah mapel
 * unik tingkat sekolah — supaya judul ringkasan tidak lagi menulis "Mapel 0"
 * saat tabelnya menampilkan 23 mapel per kelas.
 */
function tambahTotalMapel<
	T extends {
		ringkasan: { totalKelas: number } | null;
		daftarKelas: Array<{ jumlahMapel: number }>;
	}
>(hasil: T) {
	if (!hasil.ringkasan) return hasil;
	return {
		...hasil,
		ringkasan: {
			...hasil.ringkasan,
			totalMapel: hasil.daftarKelas.reduce((total, kelas) => total + kelas.jumlahMapel, 0)
		}
	};
}

const REQUIRED_PERMISSION: UserPermission = 'overview_semua_kelas';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		redirect(303, `/forbidden?required=${REQUIRED_PERMISSION}`);
	}

	const meta: PageMeta = {
		title: 'Semua Kelas',
		description: 'Ringkasan seluruh kelas: murid, guru, kelengkapan nilai, dan presensi'
	};

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		return {
			meta,
			semesterOptions: [],
			semesterTerpilih: null,
			semesterAktifId: null,
			ringkasan: null,
			daftarKelas: []
		};
	}

	const academic = await resolveSekolahAcademicContext(sekolahId);
	const semesterOptions = academic.tahunAjaranList
		.flatMap((tahunAjaran) =>
			tahunAjaran.semester.map((semester) => ({
				id: semester.id,
				nama: semester.nama,
				tipe: semester.tipe,
				tahunAjaran: tahunAjaran.nama
			}))
		)
		.sort((a, b) => b.id - a.id);

	const requested = Number(url.searchParams.get('semester'));
	const semesterTerpilih =
		semesterOptions.find((item) => item.id === requested) ??
		semesterOptions.find((item) => item.id === academic.activeSemesterId) ??
		semesterOptions[0] ??
		null;

	if (!semesterTerpilih) {
		return {
			meta,
			semesterOptions,
			semesterTerpilih: null,
			semesterAktifId: academic.activeSemesterId,
			ringkasan: null,
			daftarKelas: []
		};
	}

	const { daftarKelas, ringkasan } = await getRingkasanKelas(sekolahId, semesterTerpilih.id);
	const hasil = tambahTotalMapel({ daftarKelas, ringkasan });

	return {
		meta,
		semesterOptions,
		semesterTerpilih,
		semesterAktifId: academic.activeSemesterId,
		ringkasan: hasil.ringkasan,
		daftarKelas: hasil.daftarKelas
	};
};
