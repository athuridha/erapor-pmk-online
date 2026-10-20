import { and, eq } from 'drizzle-orm';

import db from '$lib/server/db';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { tableKelas } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { cookieNames } from '$lib/utils';
import { getRingkasanKelas } from '$lib/server/statistik-kelas';
import { isAuthorizedUser } from '../pengguna/permissions';
import type { Actions, PageServerLoad } from './$types';

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

	return {
		meta,
		semesterOptions,
		semesterTerpilih,
		semesterAktifId: academic.activeSemesterId,
		ringkasan,
		daftarKelas
	};
};

export const actions: Actions = {
	/** Jadikan kelas terpilih sebagai kelas aktif (setara fitur "Pindah Kelas") lalu buka dashboard. */
	pilihKelas: async ({ request, cookies, locals }) => {
		if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
			return fail(403, { message: 'Anda tidak memiliki izin untuk membuka kelas.' });
		}

		const formData = await request.formData();
		const kelasId = Number(formData.get('kelasId'));
		if (!Number.isInteger(kelasId) || kelasId <= 0) {
			return fail(400, { message: 'Kelas tidak valid.' });
		}

		const sekolahId = locals.sekolah?.id ?? null;
		const kelas = sekolahId
			? await db.query.tableKelas.findFirst({
					columns: { id: true },
					where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
				})
			: null;
		if (!kelas) {
			return fail(404, { message: 'Kelas tidak ditemukan pada sekolah ini.' });
		}

		cookies.set(cookieNames.ACTIVE_KELAS_ID, String(kelasId), {
			path: '/',
			secure: locals.requestIsSecure ?? false
		});
		redirect(303, `/?kelas_id=${kelasId}`);
	}
};
