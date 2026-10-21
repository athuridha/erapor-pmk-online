import { error, fail } from '@sveltejs/kit';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableAuthUser, tableKelas, tableMataPelajaran, tablePegawai } from '$lib/server/db/schema';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';
import { hapusMasterData } from '$lib/admin/master-data.server';
import { hashPassword } from '$lib/server/auth';
import { validatePasswordStrength } from '$lib/server/password-policy';
import { defaultPermissionsByType } from '../../../../pengguna/permissions';

const KELOMPOK = {
	guru: {
		judul: 'Guru',
		deskripsi:
			'Akun guru pengajar, wali kelas, dan wali asuh. Akun guru dibuat dari halaman Tambah Akun.',
		types: ['user', 'wali_kelas', 'wali_asuh']
	},
	operator: {
		judul: 'Operator',
		deskripsi: 'Akun operator sekolah: admin dan kepala sekolah.',
		types: ['admin', 'kepala_sekolah']
	}
} as const;

type KunciKelompok = keyof typeof KELOMPOK;

function labelRole(role: string): string {
	switch (role) {
		case 'admin':
			return 'Admin';
		case 'kepala_sekolah':
			return 'Kepala Sekolah';
		case 'wali_kelas':
			return 'Wali Kelas';
		case 'wali_asuh':
			return 'Wali Asuh';
		default:
			return 'Guru';
	}
}

export const load = async ({ params, locals, url }) => {
	const key = (params.kelompok ?? '') as KunciKelompok;
	const kelompok = KELOMPOK[key];
	if (!kelompok) {
		throw error(404, 'Kelompok pengguna tidak ditemukan');
	}

	const sekolahId = locals.sekolah?.id ?? null;
	if (!sekolahId) {
		throw error(401, 'Sekolah aktif tidak ditemukan');
	}
	const user = locals.user;
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Data pengguna hanya bisa dikelola admin dan kepala sekolah.');
	}

	const q = url.searchParams.get('q')?.trim() || null;
	const like = `%${q ?? ''}%`;
	const perHalaman = normalisasiBarisPerHalaman(url.searchParams.get('per_page'), 50);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const kondisi = [inArray(tableAuthUser.type, [...kelompok.types])];
	if (q) {
		kondisi.push(
			sql`(lower(auth_user.username) like ${like} or lower(coalesce(auth_user.nama_lengkap, '')) like ${like} or lower(coalesce(pegawai.nik, '')) like ${like})`
		);
	}

	const [{ total }] = await db
		.select({ total: count() })
		.from(tableAuthUser)
		.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
		.where(and(...kondisi));

	const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
	const halamanSekarang = Math.min(page, totalHalaman);
	const offset = (halamanSekarang - 1) * perHalaman;

	const rows = await db
		.select({
			id: tableAuthUser.id,
			username: tableAuthUser.username,
			namaLengkap: tableAuthUser.namaLengkap,
			role: tableAuthUser.type,
			pegawaiNama: tablePegawai.nama,
			nik: tablePegawai.nik,
			kelas: sql<string | null>`(select k.nama from kelas k where k.id = auth_user.kelas_id)`,
			mapel: sql<
				string | null
			>`(select mp.nama from mata_pelajaran mp where mp.id = auth_user.mata_pelajaran_id)`,
			izin: sql<number>`(select count(*) from json_each(auth_user.permissions))`,
			dibuat: tableAuthUser.createdAt
		})
		.from(tableAuthUser)
		.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
		.where(and(...kondisi))
		.orderBy(asc(tableAuthUser.username))
		.limit(perHalaman)
		.offset(offset);

	const baris = rows.map((row) => ({
		id: row.id,
		nama: row.namaLengkap ?? row.pegawaiNama ?? row.username,
		role: labelRole(row.role),
		username: row.username,
		bisaHapus: row.id !== 1 && row.username.trim().toLowerCase() !== 'admin',
		nik_username: row.nik || row.username,
		kelas: row.kelas,
		mapel: row.mapel,
		izin: row.izin,
		dibuat: row.dibuat
	}));

	const [daftarKelas, daftarMapel] = await Promise.all([
		db
			.select({ id: tableKelas.id, nama: tableKelas.nama, fase: tableKelas.fase })
			.from(tableKelas)
			.where(eq(tableKelas.sekolahId, sekolahId))
			.orderBy(asc(tableKelas.nama)),
		db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kelasId: tableMataPelajaran.kelasId
			})
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
			.where(eq(tableKelas.sekolahId, sekolahId))
			.orderBy(asc(tableMataPelajaran.nama))
	]);

	return {
		meta: { title: `Data Pengguna — ${kelompok.judul}` },
		kelompok: { key, judul: kelompok.judul, deskripsi: kelompok.deskripsi },
		baris,
		total,
		totalHalaman,
		perHalaman,
		daftarKelas,
		daftarMapel,
		filter: { q, page: halamanSekarang, perHalaman }
	};
};

function pastikanBolehKelola(locals: App.Locals): number {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw error(401, 'Sekolah aktif tidak ditemukan');
	const user = locals.user;
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Data pengguna hanya bisa dikelola admin dan kepala sekolah.');
	}
	return sekolahId;
}

export const actions = {
	async tambah({ request, locals, params }) {
		const sekolahId = pastikanBolehKelola(locals);

		const key = (params.kelompok ?? '') as KunciKelompok;
		const kelompok = KELOMPOK[key];
		if (!kelompok) return fail(404, { fail: 'Kelompok pengguna tidak ditemukan.' });

		const formData = await request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '').trim();
		const nama = String(formData.get('nama') ?? '').trim();
		const nik = String(formData.get('nik') ?? '').trim();
		const role = String(formData.get('type') ?? (key === 'operator' ? 'admin' : 'user'));
		const kelasId = Number(formData.get('kelas_id') ?? 0) || null;
		const mapelId = Number(formData.get('mata_pelajaran_id') ?? 0) || null;

		if (!username) return fail(400, { fail: 'Nama pengguna wajib diisi.' });
		if (!nama) return fail(400, { fail: 'Nama lengkap wajib diisi.' });
		if (!password) return fail(400, { fail: 'Kata sandi wajib diisi.' });

		const passwordError = validatePasswordStrength(password);
		if (passwordError) return fail(400, { fail: passwordError });
		if (nik && !/^\d{16}$/.test(nik)) {
			return fail(400, { fail: 'NIK harus 16 digit angka.' });
		}

		// Role harus sesuai kelompok halaman.
		const roleBoleh = key === 'operator' ? ['admin', 'kepala_sekolah'] : ['user', 'wali_kelas'];
		if (!roleBoleh.includes(role)) {
			return fail(400, { fail: 'Role tidak sesuai kelompok pengguna ini.' });
		}

		const [bentrok] = await db
			.select({ id: tableAuthUser.id })
			.from(tableAuthUser)
			.where(eq(tableAuthUser.usernameNormalized, username.toLowerCase()))
			.limit(1);
		if (bentrok) {
			return fail(400, { fail: 'Nama pengguna sudah dipakai.' });
		}

		try {
			const { hash, salt } = hashPassword(password);
			const timestamp = new Date().toISOString();

			const [pegawai] = await db
				.insert(tablePegawai)
				.values({ nama, nip: '', nik: nik || null })
				.returning({ id: tablePegawai.id });

			await db.insert(tableAuthUser).values({
				username,
				usernameNormalized: username.toLowerCase(),
				passwordHash: hash,
				passwordSalt: salt,
				passwordUpdatedAt: timestamp,
				permissions: defaultPermissionsByType[role as keyof typeof defaultPermissionsByType] ?? [],
				type: role as 'admin' | 'kepala_sekolah' | 'wali_kelas' | 'user',
				mataPelajaranId: mapelId ?? undefined,
				kelasId: kelasId ?? undefined,
				sekolahId,
				pegawaiId: pegawai?.id ?? undefined,
				createdAt: timestamp,
				updatedAt: timestamp
			});
		} catch (error) {
			console.error('[master-data-pengguna] gagal menambah akun:', error);
			return fail(500, { fail: 'Gagal membuat akun pengguna.' });
		}

		return { message: `Akun ${nama} berhasil dibuat.` };
	},

	async hapus({ request, locals }) {
		const sekolahId = pastikanBolehKelola(locals);
		const formData = await request.formData();
		const id = Number(formData.get('id') ?? 0);
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'Akun pengguna tidak valid.' });
		}
		const hasil = await hapusMasterData(sekolahId, 'pengguna', id);
		if (hasil.fail) return fail(400, { fail: hasil.fail });
		return { message: hasil.message };
	},

	async hapusMassal({ request, locals }) {
		const sekolahId = pastikanBolehKelola(locals);
		const formData = await request.formData();
		let ids: number[] = [];
		try {
			const parsed = JSON.parse(String(formData.get('ids') ?? '[]'));
			if (Array.isArray(parsed)) {
				ids = parsed
					.map((value) => Number(value))
					.filter((value) => Number.isInteger(value) && value > 0);
			}
		} catch {
			return fail(400, { fail: 'Data pilihan tidak valid.' });
		}
		if (!ids.length) {
			return fail(400, { fail: 'Tidak ada akun yang dipilih.' });
		}

		let terhapus = 0;
		const gagal: string[] = [];
		for (const id of ids) {
			const hasil = await hapusMasterData(sekolahId, 'pengguna', id);
			if (hasil.fail) gagal.push(hasil.fail);
			else terhapus += 1;
		}
		return {
			message: `${terhapus} akun dihapus${gagal.length ? `, ${gagal.length} gagal: ${gagal[0]}` : ''}.`
		};
	}
};
