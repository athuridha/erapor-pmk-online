import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import {
	tableAuthUser,
	tableEkstrakurikuler,
	tableKelas,
	tableMataPelajaran,
	tablePegawai,
	tableSekolah
} from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { authority } from '../../../../pengguna/utils.server';

const STATUS_AKTIF = ['aktif', 'nonaktif'];
const JENIS_KELAMIN = ['L', 'P'];
const FOTO_MAX_BYTES = 400_000;
const FOTO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function teks(form: FormData, key: string) {
	return String(form.get(key) ?? '').trim();
}

function nullable(value: string) {
	return value ? value : null;
}

export async function load({ params, locals }) {
	authority('user_detail');

	const id = Number(params.id);
	if (!Number.isFinite(id)) error(400, 'ID guru tidak valid');

	const pegawai = await db.query.tablePegawai.findFirst({
		where: eq(tablePegawai.id, id)
	});
	if (!pegawai) error(404, 'Data guru tidak ditemukan');

	const account = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.pegawaiId, id)
	});

	const [waliKelas, mapelRows, kelasRows, ekskul, kepsek] = await Promise.all([
		db
			.select({ id: tableKelas.id, nama: tableKelas.nama, fase: tableKelas.fase })
			.from(tableKelas)
			.where(eq(tableKelas.waliKelasId, id))
			.orderBy(asc(tableKelas.nama)),
		db
			.select({ id: tableMataPelajaran.id, nama: tableMataPelajaran.nama })
			.from(tableMataPelajaran)
			.where(eq(tableMataPelajaran.pengampuId, id)),
		db
			.select({ id: tableKelas.id, nama: tableKelas.nama, fase: tableKelas.fase })
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableMataPelajaran.kelasId, tableKelas.id))
			.where(eq(tableMataPelajaran.pengampuId, id))
			.orderBy(asc(tableKelas.nama)),
		account
			? db
					.select({ id: tableEkstrakurikuler.id, nama: tableEkstrakurikuler.nama })
					.from(tableEkstrakurikuler)
					.where(eq(tableEkstrakurikuler.pembinaUserId, account.id))
					.orderBy(asc(tableEkstrakurikuler.nama))
			: Promise.resolve([]),
		db.query.tableSekolah.findFirst({
			columns: { id: true },
			where: eq(tableSekolah.kepalaSekolahId, id)
		})
	]);

	const sekolahId = locals.sekolah?.id ?? pegawai.sekolahId;
	const academic = sekolahId ? await resolveSekolahAcademicContext(sekolahId) : null;
	const activeTahun = academic?.tahunAjaranList.find((t) => t.id === academic.activeTahunAjaranId);
	const activeSemester = activeTahun?.semester.find((s) => s.id === academic?.activeSemesterId);

	return {
		pegawai: {
			id: pegawai.id,
			nama: pegawai.nama,
			nip: pegawai.nip,
			nik: pegawai.nik,
			nuptk: pegawai.nuptk,
			fotoProfil: pegawai.fotoProfil,
			jenisKelamin: pegawai.jenisKelamin,
			tempatLahir: pegawai.tempatLahir,
			tanggalLahir: pegawai.tanggalLahir,
			alamat: pegawai.alamat,
			noHp: pegawai.noHp,
			email: pegawai.email,
			statusKepegawaian: pegawai.statusKepegawaian,
			jabatan: pegawai.jabatan,
			pangkatGolongan: pegawai.pangkatGolongan,
			statusAktif: pegawai.statusAktif ?? 'aktif',
			tanggalMulaiTugas: pegawai.tanggalMulaiTugas,
			pendidikanTerakhir: pegawai.pendidikanTerakhir,
			programStudi: pegawai.programStudi,
			hasTtd: !!pegawai.tandaTangan
		},
		account: account
			? {
					id: account.id,
					username: account.username,
					type: account.type,
					roles: [
						...(Array.isArray(account.roles)
							? account.roles.filter(
									(r) => r !== 'guru' && r !== 'wali_kelas' && r !== 'kepala_sekolah'
								)
							: []),
						...(mapelRows.length ? ['guru'] : []),
						...(waliKelas.length ? ['wali_kelas'] : []),
						...(kepsek ? ['kepala_sekolah'] : [])
					],
					permissionsCount: Array.isArray(account.permissions) ? account.permissions.length : 0
				}
			: null,
		sekolahNama: locals.sekolah?.nama ?? null,
		academic: {
			tahunAjaran: activeTahun?.nama ?? null,
			semester: activeSemester?.nama ?? null
		},
		waliKelas,
		mapel: Array.from(new Map(mapelRows.map((m) => [m.nama, m])).values()),
		kelas: Array.from(new Map(kelasRows.map((k) => [k.id, k])).values()),
		ekskul
	};
}

export const actions = {
	save: async ({ params, request, locals }) => {
		authority('user_set_permissions');

		const id = Number(params.id);
		if (!Number.isFinite(id)) return fail(400, { message: 'ID guru tidak valid' });

		const form = await request.formData();
		const nama = teks(form, 'nama');
		const nip = teks(form, 'nip');
		const nik = teks(form, 'nik');
		const nuptk = teks(form, 'nuptk');
		const jenisKelamin = teks(form, 'jenisKelamin');
		const tanggalLahir = teks(form, 'tanggalLahir');
		const tanggalMulaiTugas = teks(form, 'tanggalMulaiTugas');
		const email = teks(form, 'email');
		const noHp = teks(form, 'noHp');
		const statusAktif = teks(form, 'statusAktif') || 'aktif';

		if (!nama) return fail(400, { message: 'Nama wajib diisi.' });
		if (nik && !/^\d{16}$/.test(nik)) return fail(400, { message: 'NIK harus 16 digit angka.' });
		if (nip && !/^\d{8,18}$/.test(nip)) {
			return fail(400, { message: 'NIP harus berisi 8-18 digit angka.' });
		}
		if (nuptk && !/^\d{16}$/.test(nuptk)) {
			return fail(400, { message: 'NUPTK harus 16 digit angka.' });
		}
		if (jenisKelamin && !JENIS_KELAMIN.includes(jenisKelamin)) {
			return fail(400, { message: 'Jenis kelamin tidak valid.' });
		}
		if (!STATUS_AKTIF.includes(statusAktif)) {
			return fail(400, { message: 'Status keaktifan tidak valid.' });
		}
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { message: 'Format email tidak valid.' });
		}
		if (noHp && !/^[+0-9][0-9\s-]{7,19}$/.test(noHp)) {
			return fail(400, { message: 'Nomor HP tidak valid.' });
		}
		for (const [label, tanggal] of [
			['tanggal lahir', tanggalLahir],
			['tanggal mulai bertugas', tanggalMulaiTugas]
		] as const) {
			if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
				return fail(400, { message: `Format ${label} tidak valid.` });
			}
		}

		const foto = form.get('foto');
		let fotoProfil: string | null | undefined;
		if (foto instanceof File && foto.size > 0) {
			if (!FOTO_MIME.has(foto.type)) {
				return fail(400, { message: 'Foto harus berupa PNG, JPG, atau WEBP.' });
			}
			if (foto.size > FOTO_MAX_BYTES) {
				return fail(400, { message: 'Ukuran foto maksimal 400 KB.' });
			}
			const buffer = Buffer.from(await foto.arrayBuffer());
			fotoProfil = `data:${foto.type};base64,${buffer.toString('base64')}`;
		} else if (teks(form, 'hapusFoto') === '1') {
			fotoProfil = null;
		}

		const sekolahId = locals.sekolah?.id ?? undefined;
		await db
			.update(tablePegawai)
			.set({
				...(fotoProfil !== undefined ? { fotoProfil } : {}),
				nama,
				nip,
				nik: nullable(nik),
				nuptk: nullable(nuptk),
				jenisKelamin: (jenisKelamin || null) as 'L' | 'P' | null,
				tempatLahir: nullable(teks(form, 'tempatLahir')),
				tanggalLahir: nullable(tanggalLahir),
				alamat: nullable(teks(form, 'alamat')),
				noHp: nullable(noHp),
				email: nullable(email),
				statusKepegawaian: nullable(teks(form, 'statusKepegawaian')),
				jabatan: nullable(teks(form, 'jabatan')),
				pangkatGolongan: nullable(teks(form, 'pangkatGolongan')),
				statusAktif,
				tanggalMulaiTugas: nullable(tanggalMulaiTugas),
				pendidikanTerakhir: nullable(teks(form, 'pendidikanTerakhir')),
				programStudi: nullable(teks(form, 'programStudi')),
				...(sekolahId ? { sekolahId } : {}),
				updatedAt: new Date().toISOString()
			})
			.where(eq(tablePegawai.id, id));

		return { success: true, message: 'Profil guru diperbarui' };
	}
};
