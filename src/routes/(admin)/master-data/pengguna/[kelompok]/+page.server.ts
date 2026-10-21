import { error } from '@sveltejs/kit';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableAuthUser, tablePegawai } from '$lib/server/db/schema';
import { normalisasiBarisPerHalaman } from '$lib/utils/pagination';

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
		nik_username: row.nik || row.username,
		kelas: row.kelas,
		mapel: row.mapel,
		izin: row.izin,
		dibuat: row.dibuat
	}));

	return {
		meta: { title: `Data Pengguna — ${kelompok.judul}` },
		kelompok: { key, judul: kelompok.judul, deskripsi: kelompok.deskripsi },
		baris,
		total,
		totalHalaman,
		perHalaman,
		filter: { q, page: halamanSekarang, perHalaman }
	};
};
