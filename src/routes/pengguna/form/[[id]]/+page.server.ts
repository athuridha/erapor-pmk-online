import db from '$lib/server/db';
import {
	tableAuthUser,
	tableKelas,
	tableMataPelajaran,
	tablePegawai,
	tableSekolah
} from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { fail, error } from '@sveltejs/kit';
import { authority } from '../../utils.server';
import { defaultPermissionsByType, userPermissions } from '../../permissions';
import { hashPassword } from '$lib/server/auth';
import { validatePasswordStrength } from '$lib/server/password-policy';

const u = tableAuthUser;
const VALID_PERMISSION_KEYS = new Set<string>(userPermissions);
const OPERATOR_LEVELS = ['', 'admin', 'kepala_sekolah'];

/**
 * Pilihan multi-role: checkbox boleh dikombinasi (guru + operator, dll).
 * Mapel/kelas TIDAK diatur di sini — pakai /master-data/pengampu dan /wali-kelas.
 */
function parseRoleSelection(
	form: FormData,
	derived?: { guru?: boolean; waliKelas?: boolean; kepalaSekolah?: boolean }
) {
	const rolesSet = new Set(
		form
			.getAll('roles')
			.map((value) => String(value))
			.filter(Boolean)
	);
	if (derived?.guru) rolesSet.add('guru');
	if (derived?.waliKelas) rolesSet.add('wali_kelas');
	if (derived?.kepalaSekolah) rolesSet.add('kepala_sekolah');
	if (rolesSet.size === 0) rolesSet.add('guru');

	if (rolesSet.has('pembina_eskul') && rolesSet.size === 1) {
		return {
			type: 'pembina_eskul' as AuthUser['type'],
			operatorLevel: null,
			roles: ['pembina_eskul']
		};
	}

	const hasEducator = rolesSet.has('guru') || rolesSet.has('wali_kelas');
	let type: AuthUser['type'];
	let operatorLevel: 'admin' | 'kepala_sekolah' | null = null;

	if (rolesSet.has('admin')) {
		type = 'admin';
	} else if (rolesSet.has('kepala_sekolah')) {
		type = hasEducator ? 'user' : 'kepala_sekolah';
	} else if (rolesSet.has('pembina_eskul') && !hasEducator && !rolesSet.has('operator')) {
		return {
			type: 'pembina_eskul' as AuthUser['type'],
			operatorLevel: null,
			roles: ['pembina_eskul']
		};
	} else {
		type = rolesSet.has('wali_kelas') ? 'wali_kelas' : 'user';
	}

	if (type !== 'admin') {
		if (rolesSet.has('operator')) operatorLevel = 'admin';
		else if (rolesSet.has('kepala_sekolah') && hasEducator) operatorLevel = 'kepala_sekolah';
	}

	if (!OPERATOR_LEVELS.includes(operatorLevel ?? '')) operatorLevel = null;
	const ROLE_ORDER = ['guru', 'wali_kelas', 'pembina_eskul', 'operator', 'kepala_sekolah', 'admin'];
	const roles = ROLE_ORDER.filter((role) => rolesSet.has(role));
	return { type, operatorLevel, roles };
}

function parsePermissions(
	raw: FormDataEntryValue | null,
	roleValue: string
): UserPermission[] | null {
	if (roleValue === 'admin' || roleValue === 'kepala_sekolah') return [...userPermissions];
	if (!raw) return null;
	try {
		const parsed = JSON.parse(String(raw));
		if (!Array.isArray(parsed)) return null;
		return parsed.filter(
			(p): p is UserPermission => typeof p === 'string' && VALID_PERMISSION_KEYS.has(p)
		);
	} catch {
		return null;
	}
}

/**
 * Peran guru & wali kelas bukan pilihan manual: guru berasal dari mapel yang
 * diampu (mata_pelajaran.pengampu_id), wali kelas dari penugasan di /wali-kelas.
 */
async function deriveRoles(pegawaiId: number | null | undefined) {
	if (!pegawaiId) return { guru: false, waliKelas: false, kepalaSekolah: false };
	const [mapel, wali, kepsek] = await Promise.all([
		db.query.tableMataPelajaran.findFirst({
			columns: { id: true },
			where: eq(tableMataPelajaran.pengampuId, pegawaiId)
		}),
		db.query.tableKelas.findFirst({
			columns: { id: true },
			where: eq(tableKelas.waliKelasId, pegawaiId)
		}),
		db.query.tableSekolah.findFirst({
			columns: { id: true },
			where: eq(tableSekolah.kepalaSekolahId, pegawaiId)
		})
	]);
	return { guru: !!mapel, waliKelas: !!wali, kepalaSekolah: !!kepsek };
}

function validateNik(value: string) {
	if (!value) return null;
	if (!/^\d{16}$/.test(value)) return 'NIK harus 16 digit angka.';
	return null;
}

export async function load({ params }) {
	authority(params.id ? 'user_set_permissions' : 'user_add');

	let userDetail = null;
	if (params.id) {
		const id = +params.id;
		if (!Number.isFinite(id)) error(400, 'ID pengguna tidak valid');

		const [user] = await db
			.select({
				id: u.id,
				username: u.username,
				namaLengkap: u.namaLengkap,
				type: u.type,
				operatorLevel: u.operatorLevel,
				roles: u.roles,
				pegawaiId: u.pegawaiId,
				pegawaiName: tablePegawai.nama,
				pegawaiNik: tablePegawai.nik,
				sekolahId: u.sekolahId,
				permissions: u.permissions
			})
			.from(u)
			.leftJoin(tablePegawai, eq(u.pegawaiId, tablePegawai.id))
			.where(eq(u.id, id));
		if (!user) error(404, 'Pengguna tidak ditemukan');

		const roles: string[] = [];
		if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
			roles.push(...user.roles.filter((r) => typeof r === 'string'));
		} else if (user.type === 'admin') {
			roles.push('admin');
		} else if (user.type === 'kepala_sekolah') {
			roles.push('kepala_sekolah');
		} else if (user.type === 'pembina_eskul') {
			roles.push('pembina_eskul');
		} else if (user.type === 'wali_kelas') {
			roles.push('wali_kelas', 'guru');
		} else {
			roles.push('guru');
		}
		if (!Array.isArray(user.roles)) {
			if (user.operatorLevel === 'admin') roles.push('operator');
			if (user.operatorLevel === 'kepala_sekolah') roles.push('kepala_sekolah');
		}

		const derived = await deriveRoles(user.pegawaiId);
		if (derived.guru) roles.push('guru');
		if (derived.waliKelas) roles.push('wali_kelas');
		if (derived.kepalaSekolah) roles.push('kepala_sekolah');
		userDetail = { ...user, roles: Array.from(new Set(roles)), derived };
	}

	const sekolahList = await db
		.select({ id: tableSekolah.id, nama: tableSekolah.nama })
		.from(tableSekolah)
		.limit(1000);

	return {
		meta: { title: params.id ? 'Edit Pengguna' : 'Tambah Pengguna' },
		userDetail,
		sekolahList
	};
}

export const actions = {
	save: async ({ params, request }) => {
		if (params.id) return updateUser(request, +params.id);
		return createUser(request);
	}
};

async function createUser(request: Request) {
	authority('user_add');
	const form = await request.formData();
	const username = String(form.get('username') ?? '').trim();
	const password = String(form.get('password') ?? '').trim();
	const nama = String(form.get('nama') ?? '').trim();
	const nik = String(form.get('nik') ?? '').trim();
	const { type: roleValue, operatorLevel, roles: savedRoles } = parseRoleSelection(form);
	const nikError = validateNik(nik);
	if (nikError) return fail(400, { message: nikError });

	const sekolahIdRaw = form.get('sekolahId');
	const sekolahId = sekolahIdRaw ? Number(String(sekolahIdRaw)) : null;

	if (!username) return fail(400, { message: 'Username wajib diisi.' });
	if (!password) return fail(400, { message: 'Kata sandi wajib diisi.' });

	const passwordError = validatePasswordStrength(password);
	if (passwordError) return fail(400, { message: passwordError });

	try {
		const { hash, salt } = hashPassword(password);
		const timestamp = new Date().toISOString();

		const isPembinaEksternal = roleValue === 'pembina_eskul';
		let pegawaiId: number | null = null;
		if (nama && !isPembinaEksternal) {
			const [p] = await db
				.insert(tablePegawai)
				.values({ nama, nip: '', nik: nik || null, sekolahId: sekolahId ?? undefined })
				.returning({ id: tablePegawai.id });
			if (p && typeof p.id === 'number') pegawaiId = p.id;
		}

		const permissions: UserPermission[] = parsePermissions(form.get('permissions'), roleValue) ?? [
			...(defaultPermissionsByType[roleValue as AuthUser['type']] ?? []),
			...(operatorLevel ? (defaultPermissionsByType[operatorLevel] ?? []) : [])
		];

		const insertData = {
			username,
			usernameNormalized: username.toLowerCase(),
			namaLengkap: isPembinaEksternal ? nama : undefined,
			passwordHash: hash,
			passwordSalt: salt,
			passwordUpdatedAt: timestamp,
			permissions,
			type: roleValue,
			operatorLevel,
			roles: savedRoles,
			sekolahId: sekolahId ?? undefined,
			pegawaiId: pegawaiId ?? undefined,
			createdAt: timestamp,
			updatedAt: timestamp
		};

		await db.insert(tableAuthUser).values(insertData);

		const [created] = await db
			.select({
				id: u.id,
				username: u.username,
				createdAt: u.createdAt,
				type: u.type,
				passwordUpdatedAt: u.passwordUpdatedAt
			})
			.from(u)
			.where(eq(u.usernameNormalized, username.toLowerCase()))
			.orderBy(desc(u.id))
			.limit(1);

		if (!created) throw new Error('Failed to retrieve created user');

		if (savedRoles.includes('kepala_sekolah') && sekolahId && pegawaiId) {
			await db
				.update(tableSekolah)
				.set({ kepalaSekolahId: pegawaiId })
				.where(eq(tableSekolah.id, sekolahId));
		}

		console.info(`[pengguna] Created user: ${username} -> id=${created.id}, role=${roleValue}`);

		return {
			message: 'Pengguna dibuat',
			success: true,
			user: created,
			displayName: nama
		};
	} catch (err: unknown) {
		console.error('Failed to create user', err);
		const e = err as Record<string, unknown>;
		const cause = (e.cause as Record<string, unknown> | undefined) ?? undefined;
		const causeMsg = (
			(cause && String(cause.message)) ||
			(e.message && String(e.message)) ||
			String(err)
		).toString();
		if (
			causeMsg.includes('UNIQUE constraint failed') &&
			causeMsg.includes('auth_user.username_normalized')
		) {
			return fail(400, { message: 'Username sudah digunakan' });
		}
		return fail(500, { message: 'Internal Error' });
	}
}

async function updateUser(request: Request, id: number) {
	authority('user_set_permissions');
	const form = await request.formData();

	const username = String(form.get('username') ?? '').trim();
	const password = String(form.get('password') ?? '').trim();
	const nama = String(form.get('nama') ?? '').trim();
	const nik = String(form.get('nik') ?? '').trim();
	const roleValue = parseRoleSelection(form).type;
	const nikError = validateNik(nik);
	if (nikError) return fail(400, { message: nikError });

	if (!username) return fail(400, { message: 'Username wajib diisi.' });

	const sekolahId = form.get('sekolahId') ? Number(form.get('sekolahId')) : null;
	if (sekolahId) {
		const exists = await db.query.tableSekolah.findFirst({
			columns: { id: true },
			where: eq(tableSekolah.id, sekolahId)
		});
		if (!exists) return fail(400, { message: 'Sekolah tidak valid.' });
	}

	try {
		const existing = await db.query.tableAuthUser.findFirst({
			columns: { id: true, pegawaiId: true, username: true },
			where: eq(u.id, id)
		});
		if (!existing) return fail(404, { message: 'Pengguna tidak ditemukan.' });

		const derived = await deriveRoles(existing.pegawaiId);
		const role = parseRoleSelection(form, derived);

		let hashedPassword: { hash: string; salt: string } | null = null;
		if (password) {
			const passwordError = validatePasswordStrength(password);
			if (passwordError) return fail(400, { message: passwordError });
			hashedPassword = hashPassword(password);
		}

		await db.transaction(async (tx) => {
			const isPembinaEksternal = role.type === 'pembina_eskul';
			const updateData: Record<string, unknown> = {};
			if (username !== existing.username) {
				updateData.username = username;
				updateData.usernameNormalized = username.toLowerCase();
			}
			if (hashedPassword) {
				updateData.passwordHash = hashedPassword.hash;
				updateData.passwordSalt = hashedPassword.salt;
				updateData.passwordUpdatedAt = new Date().toISOString();
			}
			updateData.type = role.type;
			updateData.operatorLevel = role.operatorLevel;
			updateData.roles = role.roles;
			updateData.sekolahId = sekolahId ?? null;
			updateData.updatedAt = new Date().toISOString();
			updateData.namaLengkap = isPembinaEksternal ? nama || null : null;
			if (isPembinaEksternal) updateData.pegawaiId = null;

			const submittedPermissions = parsePermissions(form.get('permissions'), role.type);
			if (submittedPermissions) updateData.permissions = submittedPermissions;

			await tx.update(u).set(updateData).where(eq(u.id, id));

			if (!isPembinaEksternal && nama && existing.pegawaiId) {
				await tx
					.update(tablePegawai)
					.set({ nama, nik: nik || null, ...(sekolahId ? { sekolahId } : {}) })
					.where(eq(tablePegawai.id, existing.pegawaiId));
			} else if (!isPembinaEksternal && nama && !existing.pegawaiId) {
				const [p] = await tx
					.insert(tablePegawai)
					.values({ nama, nip: '', nik: nik || null, sekolahId: sekolahId ?? undefined })
					.returning({ id: tablePegawai.id });
				if (p) await tx.update(u).set({ pegawaiId: p.id }).where(eq(u.id, id));
			}

			if (role.roles.includes('kepala_sekolah') && sekolahId && existing.pegawaiId) {
				await tx
					.update(tableSekolah)
					.set({ kepalaSekolahId: existing.pegawaiId })
					.where(eq(tableSekolah.id, sekolahId));
			}
		});

		const [updated] = await db
			.select({
				id: u.id,
				username: u.username,
				type: u.type,
				passwordUpdatedAt: u.passwordUpdatedAt
			})
			.from(u)
			.where(eq(u.id, id));

		console.info(`[pengguna] Updated user: id=${id}, username=${username}, role=${roleValue}`);

		return {
			message: 'Pengguna diperbarui',
			success: true,
			user: updated,
			displayName: nama
		};
	} catch (err) {
		console.error('Failed to update user', err);
		const e = err as Record<string, unknown>;
		const cause = (e.cause as Record<string, unknown> | undefined) ?? undefined;
		const causeMsg = (
			(cause && String(cause.message)) ||
			(e.message && String(e.message)) ||
			String(err)
		).toString();
		if (
			causeMsg.includes('UNIQUE constraint failed') &&
			causeMsg.includes('auth_user.username_normalized')
		) {
			return fail(400, { message: 'Username sudah digunakan' });
		}
		return fail(500, { message: 'Gagal memperbarui pengguna' });
	}
}
