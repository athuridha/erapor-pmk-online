import db from '$lib/server/db';
import {
	tableAlamat,
	tableKelas,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

let ensuredDone = false;

function readOfficialLogo(): Uint8Array | null {
	const candidates = [path.resolve('public/logo.png'), path.resolve('static/logo.png')];
	for (const p of candidates) {
		try {
			if (fs.existsSync(p)) {
				return new Uint8Array(fs.readFileSync(p));
			}
		} catch {
			// ignore read error
		}
	}
	return null;
}

/**
 * Memastikan profil dan master data awal SMK Pratama Mulya Karawang selalu tersedia
 * sehingga pengguna tidak perlu melakukan setup manual dari nol.
 */
export async function ensureSmkPratamaMulya() {
	if (ensuredDone) return;

	const logo = readOfficialLogo();
	const nowIso = new Date().toISOString();

	// 1. Alamat Resmi
	let alamat = await db.query.tableAlamat.findFirst({
		where: eq(tableAlamat.id, 1)
	});

	if (!alamat) {
		const [createdAlamat] = await db
			.insert(tableAlamat)
			.values({
				jalan: 'Kutapohaci, Kec. Ciampel, Karawang, Jawa Barat 41363',
				desa: 'Kutapohaci',
				kecamatan: 'Ciampel',
				kabupaten: 'Kabupaten Karawang',
				provinsi: 'Jawa Barat',
				kodePos: '41363',
				createdAt: nowIso
			})
			.returning();
		alamat = createdAlamat;
	} else if (
		alamat.kabupaten !== 'Kabupaten Karawang' ||
		alamat.desa !== 'Kutapohaci' ||
		alamat.kecamatan !== 'Ciampel'
	) {
		await db
			.update(tableAlamat)
			.set({
				jalan: 'Kutapohaci, Kec. Ciampel, Karawang, Jawa Barat 41363',
				desa: 'Kutapohaci',
				kecamatan: 'Ciampel',
				kabupaten: 'Kabupaten Karawang',
				provinsi: 'Jawa Barat',
				kodePos: '41363',
				updatedAt: nowIso
			})
			.where(eq(tableAlamat.id, alamat.id));
	}

	// 2. Kepala Sekolah Resmi
	let kepalaSekolah = await db.query.tablePegawai.findFirst({
		where: eq(tablePegawai.nama, 'Dwi Yuni Nugrahayu, S.Pd, M.M')
	});

	if (!kepalaSekolah) {
		const [createdKepala] = await db
			.insert(tablePegawai)
			.values({
				nama: 'Dwi Yuni Nugrahayu, S.Pd, M.M',
				nip: '12345678',
				createdAt: nowIso
			})
			.returning();
		kepalaSekolah = createdKepala;
	} else if (kepalaSekolah.nip !== '12345678') {
		await db
			.update(tablePegawai)
			.set({
				nip: '12345678',
				updatedAt: nowIso
			})
			.where(eq(tablePegawai.id, kepalaSekolah.id));
	}

	// 3. Sekolah SMK Pratama Mulya Karawang
	let sekolah = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, 1)
	});

	if (!sekolah) {
		const [createdSekolah] = await db
			.insert(tableSekolah)
			.values({
				nama: 'SMK Pratama Mulya Karawang',
				npsn: '20260930',
				jenjangPendidikan: 'sma',
				jenjangVariant: 'smk',
				naungan: 'kemendikbud',
				alamatId: alamat.id,
				kepalaSekolahId: kepalaSekolah.id,
				email: 'info@smkpratamamulya.sch.id',
				website: 'https://smkpratamamulya.sch.id',
				lokasiTandaTangan: 'Karawang',
				logo: logo ?? undefined,
				logoType: 'image/png',
				createdAt: nowIso
			})
			.returning();
		sekolah = createdSekolah;
	} else {
		await db
			.update(tableSekolah)
			.set({
				nama: 'SMK Pratama Mulya Karawang',
				npsn: '20260930',
				jenjangPendidikan: 'sma',
				jenjangVariant: 'smk',
				naungan: 'kemendikbud',
				kepalaSekolahId: kepalaSekolah.id,
				email: 'info@smkpratamamulya.sch.id',
				website: 'https://smkpratamamulya.sch.id',
				lokasiTandaTangan: 'Karawang',
				logo: logo ?? sekolah.logo,
				logoType: 'image/png',
				updatedAt: nowIso
			})
			.where(eq(tableSekolah.id, sekolah.id));
	}

	// 4. Tahun Ajaran 2026/2027
	let tahunAjaran = await db.query.tableTahunAjaran.findFirst({
		where: eq(tableTahunAjaran.sekolahId, sekolah.id)
	});

	if (!tahunAjaran) {
		const [createdTa] = await db
			.insert(tableTahunAjaran)
			.values({
				sekolahId: sekolah.id,
				nama: '2026/2027',
				tanggalMulai: '2026-07-15',
				tanggalSelesai: '2027-06-25',
				isAktif: true,
				createdAt: nowIso
			})
			.returning();
		tahunAjaran = createdTa;
	}

	// 5. Semester Ganjil & Genap
	let semesterGanjil = await db.query.tableSemester.findFirst({
		where: eq(tableSemester.tahunAjaranId, tahunAjaran.id)
	});

	if (!semesterGanjil) {
		const [createdSemGanjil] = await db
			.insert(tableSemester)
			.values({
				tahunAjaranId: tahunAjaran.id,
				tipe: 'ganjil',
				nama: 'Semester Ganjil',
				tanggalMulai: '2026-07-15',
				tanggalSelesai: '2026-12-20',
				tanggalBagiRaport: '2026-12-19',
				isAktif: true,
				createdAt: nowIso
			})
			.returning();
		semesterGanjil = createdSemGanjil;

		await db.insert(tableSemester).values({
			tahunAjaranId: tahunAjaran.id,
			tipe: 'genap',
			nama: 'Semester Genap',
			tanggalMulai: '2027-01-05',
			tanggalSelesai: '2027-06-25',
			tanggalBagiRaport: '2027-06-20',
			isAktif: false,
			createdAt: nowIso
		});
	}

	// 6. Guru Wali Kelas & Kelas X RPL 1
	let guruWali = await db.query.tablePegawai.findFirst({
		where: eq(tablePegawai.nama, 'Amara Thuridha, S.Kom')
	});

	if (!guruWali) {
		const [createdGuru] = await db
			.insert(tablePegawai)
			.values({
				nama: 'Amara Thuridha, S.Kom',
				nip: '12345678',
				sekolahId: sekolah.id,
				createdAt: nowIso
			})
			.returning();
		guruWali = createdGuru;
	}

	const kelas = await db.query.tableKelas.findFirst({
		where: eq(tableKelas.sekolahId, sekolah.id)
	});

	if (!kelas) {
		await db.insert(tableKelas).values({
			sekolahId: sekolah.id,
			tahunAjaranId: tahunAjaran.id,
			semesterId: semesterGanjil.id,
			nama: 'X RPL 1',
			fase: 'Fase E',
			waliKelasId: guruWali.id,
			createdAt: nowIso
		});
	}

	ensuredDone = true;
}
