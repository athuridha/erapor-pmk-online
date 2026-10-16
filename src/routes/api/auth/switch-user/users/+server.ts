import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { tableAuthUser, tablePegawai, tableKelas } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import { isAdminUser } from '../../../../pengguna/permissions';

export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	const impersonator = locals.impersonator;

	// Hanya boleh diakses bila akun saat ini adalah admin atau sedang dalam mode switch dari admin
	const hasAccess = isAdminUser(currentUser) || (impersonator && (impersonator.type === 'admin' || impersonator.type === 'kepala_sekolah'));
	if (!hasAccess) {
		throw error(403, 'Hanya admin yang dapat melihat daftar pengguna switch akun.');
	}

	const q = url.searchParams.get('q')?.trim().toLowerCase() || '';

	const u = tableAuthUser;
	const users = await db
		.select({
			id: u.id,
			username: u.username,
			type: u.type,
			pegawaiId: u.pegawaiId,
			pegawaiName: tablePegawai.nama,
			kelasId: u.kelasId,
			kelasName: tableKelas.nama
		})
		.from(u)
		.leftJoin(tablePegawai, eq(u.pegawaiId, tablePegawai.id))
		.leftJoin(tableKelas, eq(u.kelasId, tableKelas.id))
		.where(
			q
				? sql`lower(${u.username}) like ${'%' + q + '%'} or lower(coalesce(${tablePegawai.nama}, '')) like ${'%' + q + '%'}`
				: undefined
		)
		.orderBy(u.id)
		.limit(100);

	const roleLabel: Record<string, string> = {
		admin: 'Admin',
		kepala_sekolah: 'Kepala Sekolah',
		wali_kelas: 'Wali Kelas',
		wali_asuh: 'Wali Asuh',
		user: 'Guru'
	};

	return json({
		success: true,
		users: users.map((user) => ({
			id: user.id,
			username: user.username,
			fullName: user.pegawaiName || user.username,
			role: user.type,
			roleLabel: roleLabel[user.type] ?? user.type,
			kelasName: user.kelasName ?? null
		}))
	});
};
