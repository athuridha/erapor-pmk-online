import db from '$lib/server/db';
import { tableKelas, tablePegawai, tableAuthUser } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { isAdminUser } from '../../pengguna/permissions';
import type { Actions, PageServerLoad } from './$types';
import { defaultPermissionsByType } from '../../pengguna/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!isAdminUser(user)) {
		throw redirect(303, '/forbidden?required=overview_semua_kelas');
	}
	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) throw error(401, 'Sekolah aktif tidak ditemukan.');

	const academic = await resolveSekolahAcademicContext(sekolahId);
	const semesterId = academic?.activeSemesterId ?? null;

	const kelas = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, fase: true, waliKelasId: true },
		with: { semester: { columns: { nama: true } } },
		where: semesterId
			? and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.semesterId, semesterId))
			: eq(tableKelas.sekolahId, sekolahId),
		orderBy: asc(tableKelas.nama)
	});

	const pegawai = await db.query.tablePegawai.findMany({
		columns: { id: true, nama: true, nip: true },
		where: eq(tablePegawai.sekolahId, sekolahId),
		orderBy: asc(tablePegawai.nama)
	});

	// Satu guru satu kelas: pegawaiId -> kelasId.
	const waliKelasByPegawai: Record<number, number> = {};
	for (const item of kelas) {
		if (item.waliKelasId) waliKelasByPegawai[item.waliKelasId] = item.id;
	}

	return {
		meta: { title: 'Wali Kelas' },
		pegawai,
		kelas: kelas.map(({ id, nama, fase }) => ({ id, nama, fase })),
		semesterNama: kelas[0]?.semester?.nama ?? null,
		waliKelasByPegawai
	};
};

export const actions: Actions = {
	async setWali({ request, locals }) {
		if (!isAdminUser(locals.user)) {
			return fail(403, { fail: 'Hanya admin/kepala sekolah yang dapat menugaskan wali kelas.' });
		}
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) return fail(401, { fail: 'Sekolah aktif tidak ditemukan.' });

		const form = await request.formData();
		const pegawaiId = Number(form.get('pegawaiId'));
		const kelasId = Number(form.get('kelasId')) || null;
		if (!Number.isInteger(pegawaiId) || pegawaiId <= 0) {
			return fail(400, { fail: 'Pegawai tidak valid.' });
		}

		const pegawai = await db.query.tablePegawai.findFirst({
			columns: { id: true, nama: true },
			where: and(eq(tablePegawai.id, pegawaiId), eq(tablePegawai.sekolahId, sekolahId))
		});
		if (!pegawai) return fail(404, { fail: 'Pegawai tidak ditemukan di sekolah ini.' });

		if (kelasId) {
			const kelas = await db.query.tableKelas.findFirst({
				columns: { id: true, nama: true },
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
			});
			if (!kelas) return fail(404, { fail: 'Kelas tidak ditemukan di sekolah ini.' });
		}

		const now = new Date().toISOString();
		// Lepas penugasan lama agar satu guru hanya menjadi wali satu kelas.
		await db
			.update(tableKelas)
			.set({ waliKelasId: null, updatedAt: now })
			.where(and(eq(tableKelas.sekolahId, sekolahId), eq(tableKelas.waliKelasId, pegawaiId)));

		if (kelasId) {
			await db
				.update(tableKelas)
				.set({ waliKelasId: pegawaiId, updatedAt: now })
				.where(and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId)));

			// Wali kelas otomatis mendapat izin template wali kelas.
			const akun = await db.query.tableAuthUser.findFirst({
				columns: { id: true, permissions: true },
				where: eq(tableAuthUser.pegawaiId, pegawaiId)
			});
			if (akun) {
				const merged = new Set<string>([
					...(akun.permissions ?? []),
					...defaultPermissionsByType.wali_kelas
				]);
				await db
					.update(tableAuthUser)
					.set({ permissions: Array.from(merged) as UserPermission[], updatedAt: now })
					.where(eq(tableAuthUser.id, akun.id));
			}
		}

		return {
			message: kelasId
				? `Wali kelas ${pegawai.nama} disimpan.`
				: 'Penugasan wali kelas dikosongkan.'
		};
	}
};
