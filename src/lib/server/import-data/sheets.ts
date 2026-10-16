// Definisi berkas impor data pokok. Satu sumber kebenaran untuk dua pemakai:
// pembuat template (kolom + contoh + petunjuk) dan pembaca berkas (label → kunci kolom).
//
// Pemisahan ini disengaja: template dan parser tidak boleh berbeda pendapat soal
// urutan atau ejaan judul kolom.

export type SheetKey = 'guru' | 'kelas' | 'murid' | 'mapel';

export type KolomSpec = {
	// Kunci internal; juga diterima sebagai judul kolom alternatif di berkas.
	key: string;
	// Judul kolom di template.
	label: string;
	wajib?: boolean;
	contoh: string;
	petunjuk?: string;
	lebar?: number;
};

export type SheetSpec = {
	key: SheetKey;
	// Nama sheet di workbook. Pencocokan nama sheet mengabaikan besar-kecil huruf.
	sheet: string;
	judul: string;
	ringkas: string;
	// Keterangan kunci pencocokan, dipakai di halaman & petunjuk.
	kunci: string;
	kolom: KolomSpec[];
};

export const SHEETS: Record<SheetKey, SheetSpec> = {
	guru: {
		key: 'guru',
		sheet: 'Guru',
		judul: 'Guru dan Pegawai',
		ringkas: 'Data induk guru dan pegawai.',
		kunci: 'NIP',
		kolom: [
			{ key: 'nama', label: 'Nama', wajib: true, contoh: 'Budi Santoso', lebar: 32 },
			{ key: 'nip', label: 'NIP', wajib: true, contoh: '198501012010011001', lebar: 22 },
			{ key: 'nuptk', label: 'NUPTK', contoh: '1234567890123456', lebar: 20 }
		]
	},
	kelas: {
		key: 'kelas',
		sheet: 'Kelas',
		judul: 'Kelas',
		ringkas: 'Kelas pada semester aktif.',
		kunci: 'nama kelas',
		kolom: [
			{ key: 'nama', label: 'Nama Kelas', wajib: true, contoh: 'X RPL 1', lebar: 20 },
			{ key: 'fase', label: 'Fase', contoh: 'E', lebar: 10 },
			{
				key: 'wali_kelas_nip',
				label: 'NIP Wali Kelas',
				contoh: '198501012010011001',
				petunjuk: 'Harus ada di sheet Guru atau sudah terdaftar. Kosongkan kalau belum ditetapkan.',
				lebar: 22
			}
		]
	},
	murid: {
		key: 'murid',
		sheet: 'Murid',
		judul: 'Murid',
		ringkas: 'Murid beserta penempatan kelasnya.',
		kunci: 'NIS',
		kolom: [
			{ key: 'nis', label: 'NIS', wajib: true, contoh: '24001', lebar: 14 },
			{ key: 'nisn', label: 'NISN', contoh: '0071234567', lebar: 16 },
			{ key: 'nama', label: 'Nama Murid', wajib: true, contoh: 'Ahmad Fauzi', lebar: 32 },
			{
				key: 'jenis_kelamin',
				label: 'Jenis Kelamin (L/P)',
				wajib: true,
				contoh: 'L',
				petunjuk: 'L atau P.',
				lebar: 20
			},
			{ key: 'kelas', label: 'Kelas', wajib: true, contoh: 'X RPL 1', lebar: 16 },
			{ key: 'tempat_lahir', label: 'Tempat Lahir', contoh: 'Karawang', lebar: 18 },
			{
				key: 'tanggal_lahir',
				label: 'Tanggal Lahir',
				contoh: '2009-05-17',
				petunjuk: 'Format YYYY-MM-DD, DD/MM/YYYY, atau DD-MM-YYYY.',
				lebar: 18
			},
			{ key: 'agama', label: 'Agama', contoh: 'Islam', lebar: 14 },
			{
				key: 'pendidikan_sebelumnya',
				label: 'Pendidikan Sebelumnya',
				contoh: 'SMP',
				lebar: 22
			},
			{
				key: 'tanggal_masuk',
				label: 'Tanggal Masuk',
				contoh: '2024-07-15',
				petunjuk: 'Format tanggal sama dengan Tanggal Lahir.',
				lebar: 18
			},
			{ key: 'nama_ayah', label: 'Nama Ayah', contoh: 'Slamet Riyadi', lebar: 26 },
			{ key: 'nama_ibu', label: 'Nama Ibu', contoh: 'Siti Aminah', lebar: 26 },
			{
				key: 'alamat_jalan',
				label: 'Alamat',
				contoh: 'Jl. Melati No. 3',
				petunjuk: 'Kosongkan seluruh kolom alamat kalau belum ada datanya.',
				lebar: 30
			},
			{ key: 'alamat_desa', label: 'Desa/Kelurahan', contoh: 'Purwasari', lebar: 20 },
			{ key: 'alamat_kecamatan', label: 'Kecamatan', contoh: 'Purwasari', lebar: 20 },
			{ key: 'alamat_kabupaten', label: 'Kabupaten/Kota', contoh: 'Karawang', lebar: 20 }
		]
	},
	mapel: {
		key: 'mapel',
		sheet: 'Mapel',
		judul: 'Mata Pelajaran',
		ringkas: 'Mata pelajaran per kelas beserta guru pengampu.',
		kunci: 'kelas + nama mapel',
		kolom: [
			{ key: 'kelas', label: 'Kelas', wajib: true, contoh: 'X RPL 1', lebar: 16 },
			{ key: 'nama', label: 'Nama Mapel', wajib: true, contoh: 'Matematika', lebar: 32 },
			{ key: 'kode', label: 'Kode', contoh: 'MAT', lebar: 12 },
			{ key: 'kkm', label: 'KKM', contoh: '70', lebar: 8 },
			{
				key: 'jenis',
				label: 'Jenis',
				wajib: true,
				contoh: 'wajib',
				petunjuk: 'wajib, pilihan, mulok, kejuruan, pemberdayaan, atau belum_dipetakan.',
				lebar: 18
			},
			{
				key: 'pengampu_nip',
				label: 'NIP Pengampu',
				contoh: '198501012010011001',
				petunjuk: 'Harus ada di sheet Guru atau sudah terdaftar.',
				lebar: 22
			}
		]
	}
};

/** Urutan pengerjaan mengikuti ketergantungan: guru → kelas → murid → mapel. */
export const SHEET_ORDER: SheetKey[] = ['guru', 'kelas', 'murid', 'mapel'];

/** Samakan judul kolom: huruf kecil, tanpa spasi/tanda baca. */
export function normalKolom(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

export function sheetByNama(nama: string): SheetSpec | null {
	const target = normalKolom(nama);
	for (const spec of Object.values(SHEETS)) {
		if (normalKolom(spec.sheet) === target) return spec;
	}
	return null;
}

export const AGAMA_JENIS_MAPEL = [
	'belum_dipetakan',
	'wajib',
	'pilihan',
	'mulok',
	'kejuruan',
	'pemberdayaan'
] as const;
