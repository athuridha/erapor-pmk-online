/**
 * Definisi Master Data: data referensi yang dipakai modul lain
 * (tahun ajaran, semester, kelas, mata pelajaran, guru, profil sekolah).
 *
 * Field didefinisikan di sini supaya halaman Master Data bisa membuat form
 * tambah/ ubah secara seragam, dan nilainya disimpan ke tabel yang sama
 * dengan modul aslinya.
 */

export type TipeField =
	'teks' | 'textarea' | 'angka' | 'desimal' | 'toggle' | 'tanggal' | 'pilihan' | 'relasi';

export type SumberRelasi = 'kelas' | 'mapel' | 'pegawai' | 'tahun_ajaran' | 'semester';

export interface FieldMaster {
	/** Nama kolom di database (snake_case). */
	key: string;
	label: string;
	tipe: TipeField;
	wajib?: boolean;
	placeholder?: string;
	bantu?: string;
	/** Sumber pilihan untuk field relasi. */
	relasi?: SumberRelasi;
	/** Pilihan tetap (untuk tipe 'pilihan'). */
	opsi?: Array<{ label: string; value: string }>;
	/** Opsi tambahan untuk field relasi (mis. "Semua Kelas" untuk ekstrakurikuler). */
	opsiTambahan?: Array<{ label: string; value: string }>;
	default?: string | number | boolean;
}

export interface MasterData {
	key: string;
	judul: string;
	deskripsi: string;
	ikon: 'calendar' | 'layers' | 'users' | 'book' | 'user' | 'school';
	/** Nama tabel di database (untuk pesan hapus). */
	tabel: string;
	/** URL khusus (bila halaman entitas punya halaman sendiri). */
	path?: string;
	fields: FieldMaster[];
	/** Kolom yang ditampilkan di tabel. */
	kolom: Array<{ key: string; label: string }>;
	/** Tambah/ubah memakai form khusus (mis. form pengguna), bukan form generik. */
	formPengguna?: boolean;
	/** Halaman form tambah/ubah khusus. */
	tambahPath?: string;
}

export const MASTER_DATA: MasterData[] = [
	{
		key: 'tahun_ajaran',
		judul: 'Tahun Ajaran',
		deskripsi: 'Kalender pendidikan sekolah, dipakai untuk mengelompokkan semester.',
		ikon: 'calendar',
		tabel: 'tahun_ajaran',
		fields: [
			{
				key: 'nama',
				label: 'Nama Tahun Ajaran',
				tipe: 'teks',
				wajib: true,
				placeholder: '2026/2027'
			},
			{ key: 'tanggal_mulai', label: 'Tanggal Mulai', tipe: 'tanggal' },
			{ key: 'tanggal_selesai', label: 'Tanggal Selesai', tipe: 'tanggal' },
			{ key: 'is_aktif', label: 'Aktif', tipe: 'toggle', default: false }
		],
		kolom: [
			{ key: 'nama', label: 'Nama' },
			{ key: 'tanggal_mulai', label: 'Mulai' },
			{ key: 'tanggal_selesai', label: 'Selesai' },
			{ key: 'is_aktif', label: 'Aktif' }
		]
	},
	{
		key: 'semester',
		judul: 'Semester',
		deskripsi: 'Semester ganjil/genap dalam satu tahun ajaran.',
		ikon: 'layers',
		tabel: 'semester',
		fields: [
			{
				key: 'tahun_ajaran_id',
				label: 'Tahun Ajaran',
				tipe: 'relasi',
				relasi: 'tahun_ajaran',
				wajib: true
			},
			{
				key: 'tipe',
				label: 'Tipe',
				tipe: 'pilihan',
				wajib: true,
				opsi: [
					{ label: 'Ganjil', value: 'ganjil' },
					{ label: 'Genap', value: 'genap' }
				]
			},
			{
				key: 'nama',
				label: 'Nama Semester',
				tipe: 'teks',
				wajib: true,
				placeholder: 'Semester Ganjil'
			},
			{ key: 'tanggal_mulai', label: 'Tanggal Mulai', tipe: 'tanggal' },
			{ key: 'tanggal_selesai', label: 'Tanggal Selesai', tipe: 'tanggal' },
			{ key: 'tanggal_bagi_raport', label: 'Tanggal Bagi Rapor', tipe: 'tanggal' },
			{ key: 'tanggal_masuk', label: 'Tanggal Masuk', tipe: 'tanggal' },
			{ key: 'is_aktif', label: 'Aktif', tipe: 'toggle', default: false }
		],
		kolom: [
			{ key: 'nama', label: 'Nama' },
			{ key: 'tahun_ajaran', label: 'Tahun Ajaran' },
			{ key: 'tipe', label: 'Tipe' },
			{ key: 'tanggal_mulai', label: 'Mulai' },
			{ key: 'is_aktif', label: 'Aktif' }
		]
	},
	{
		key: 'kelas',
		judul: 'Kelas / Rombel',
		deskripsi: 'Rombongan belajar beserta semester, fase, dan wali kelasnya.',
		ikon: 'users',
		tabel: 'kelas',
		fields: [
			{ key: 'nama', label: 'Nama Kelas', tipe: 'teks', wajib: true, placeholder: 'XII TSM' },
			{
				key: 'tahun_ajaran_id',
				label: 'Tahun Ajaran',
				tipe: 'relasi',
				relasi: 'tahun_ajaran',
				wajib: true
			},
			{ key: 'semester_id', label: 'Semester', tipe: 'relasi', relasi: 'semester', wajib: true },
			{ key: 'fase', label: 'Fase', tipe: 'teks', placeholder: 'E / F' },
			{ key: 'wali_kelas_id', label: 'Wali Kelas', tipe: 'relasi', relasi: 'pegawai' },
			{ key: 'wali_asuh_id', label: 'Wali Asuh', tipe: 'relasi', relasi: 'pegawai' }
		],
		kolom: [
			{ key: 'nama', label: 'Kelas' },
			{ key: 'fase', label: 'Fase' },
			{ key: 'semester', label: 'Semester' },
			{ key: 'wali_kelas', label: 'Wali Kelas' },
			{ key: 'jumlah_murid', label: 'Murid' }
		]
	},
	{
		key: 'mata_pelajaran',
		judul: 'Mata Pelajaran',
		deskripsi: 'Mapel intrakurikuler, KKM, urutan, dan guru pengampu.',
		ikon: 'book',
		tabel: 'mata_pelajaran',
		fields: [
			{ key: 'nama', label: 'Nama Mata Pelajaran', tipe: 'teks', wajib: true },
			{
				key: 'kelas_id',
				label: 'Kelas / Rombel',
				tipe: 'relasi',
				relasi: 'kelas',
				placeholder: 'Semua Kelas (Kosongkan jika berlaku untuk semua kelas)'
			},
			{
				key: 'jenis',
				label: 'Jenis',
				tipe: 'pilihan',
				wajib: true,
				default: 'wajib',
				opsi: [
					{ label: 'Wajib', value: 'wajib' },
					{ label: 'Pilihan', value: 'pilihan' },
					{ label: 'Mulok', value: 'mulok' },
					{ label: 'Kejuruan', value: 'kejuruan' },
					{ label: 'Pemberdayaan', value: 'pemberdayaan' },
					{ label: 'Belum Dipetakan', value: 'belum_dipetakan' }
				]
			},
			{ key: 'kode', label: 'Kode', tipe: 'teks', placeholder: 'MTK' },
			{ key: 'kkm', label: 'KKM', tipe: 'angka', default: 0 },
			{ key: 'urutan', label: 'Urutan Tampil', tipe: 'angka' },
			{ key: 'pengampu_id', label: 'Guru Pengampu', tipe: 'relasi', relasi: 'pegawai' }
		],
		kolom: [
			{ key: 'nama', label: 'Mata Pelajaran' },
			{ key: 'kode', label: 'Kode' },
			{ key: 'jenis', label: 'Jenis' },
			{ key: 'kkm', label: 'KKM' },
			{ key: 'kelas', label: 'Kelas / Rombel' },
			{ key: 'pengampu', label: 'Guru Pengampu' }
		]
	},
	{
		key: 'ekstrakurikuler',
		judul: 'Ekstrakurikuler',
		deskripsi: 'Kegiatan ekstrakurikuler per kelas beserta daftar anggotanya.',
		ikon: 'layers',
		tabel: 'ekstrakurikuler',
		fields: [
			{
				key: 'nama',
				label: 'Nama Ekstrakurikuler',
				tipe: 'teks',
				wajib: true,
				placeholder: 'Pramuka'
			},
			{
				key: 'kelas_id',
				label: 'Kelas',
				tipe: 'relasi',
				relasi: 'kelas',
				wajib: false,
				opsiTambahan: [{ label: 'Semua Kelas', value: '' }],
				bantu: 'Pilih "Semua Kelas" bila ekstrakurikuler berlaku untuk seluruh sekolah.'
			}
		],
		kolom: [
			{ key: 'nama', label: 'Ekstrakurikuler' },
			{ key: 'kelas', label: 'Kelas' },
			{ key: 'jumlah_anggota', label: 'Anggota' }
		]
	},
	{
		key: 'pengguna',
		judul: 'Guru & Pegawai',
		deskripsi:
			'Akun guru, kepala sekolah, dan wali kelas. CRUD memakai form yang sama dengan Manajemen Pengguna.',
		ikon: 'users',
		tabel: 'auth_user',
		/** Dikelompokkan jadi Data Pengguna: Guru & Operator. */
		path: '/master-data/pengguna/guru',
		/** Tambah/ubah memakai form pengguna (bukan form master data generik). */
		formPengguna: true,
		tambahPath: '/pengguna/form',
		fields: [],
		kolom: [
			{ key: 'nama', label: 'Nama' },
			{ key: 'role', label: 'Role' },
			{ key: 'nik_username', label: 'NIK / Username' },
			{ key: 'kelas', label: 'Kelas' },
			{ key: 'mapel', label: 'Mata Pelajaran' },
			{ key: 'izin', label: 'Hak Akses' },
			{ key: 'dibuat', label: 'Dibuat' }
		]
	},
	{
		key: 'murid',
		judul: 'Murid',
		deskripsi:
			'Data induk murid: identitas, kelas, alamat, dan orang tua/wali. Bergabung dengan rapor & portal.',
		ikon: 'user',
		tabel: 'murid',
		fields: [
			{ key: 'nis', label: 'NIS', tipe: 'teks', wajib: true },
			{ key: 'nisn', label: 'NISN', tipe: 'teks', wajib: true },
			{ key: 'nama', label: 'Nama Lengkap', tipe: 'teks', wajib: true },
			{ key: 'kelas_id', label: 'Kelas', tipe: 'relasi', relasi: 'kelas', wajib: true },
			{
				key: 'jenis_kelamin',
				label: 'Jenis Kelamin',
				tipe: 'pilihan',
				wajib: true,
				opsi: [
					{ label: 'Laki-laki', value: 'L' },
					{ label: 'Perempuan', value: 'P' }
				]
			},
			{ key: 'agama', label: 'Agama', tipe: 'teks' },
			{ key: 'tempat_lahir', label: 'Tempat Lahir', tipe: 'teks' },
			{ key: 'tanggal_lahir', label: 'Tanggal Lahir', tipe: 'tanggal' },
			{ key: 'tanggal_masuk', label: 'Tanggal Masuk', tipe: 'tanggal' },
			{ key: 'pendidikan_sebelumnya', label: 'Pendidikan Sebelumnya', tipe: 'teks' },
			{
				key: 'alamat',
				label: 'Alamat',
				tipe: 'textarea',
				placeholder: 'Jalan, desa, kecamatan, kabupaten'
			},
			{ key: 'ayah_nama', label: 'Nama Ayah', tipe: 'teks' },
			{ key: 'ibu_nama', label: 'Nama Ibu', tipe: 'teks' },
			{ key: 'wali_nama', label: 'Nama Wali', tipe: 'teks' },
			{ key: 'wali_asuh_nama', label: 'Wali Asuh', tipe: 'teks' },
			{ key: 'nik', label: 'NIK', tipe: 'teks' },
			{ key: 'anak_ke', label: 'Anak Ke', tipe: 'angka' },
			{
				key: 'status',
				label: 'Status',
				tipe: 'pilihan',
				default: 'aktif',
				opsi: [
					{ label: 'Aktif', value: 'aktif' },
					{ label: 'Lulus', value: 'lulus' },
					{ label: 'Pindah', value: 'pindah' },
					{ label: 'Keluar', value: 'keluar' }
				]
			},
			{ key: 'tanggal_lulus', label: 'Tanggal Lulus', tipe: 'tanggal' }
		],
		kolom: [
			{ key: 'nis', label: 'NIS' },
			{ key: 'nisn', label: 'NISN' },
			{ key: 'nama', label: 'Nama' },
			{ key: 'kelas', label: 'Kelas' },
			{ key: 'jk', label: 'JK' },
			{ key: 'agama', label: 'Agama' },
			{ key: 'ayah', label: 'Ayah' },
			{ key: 'status', label: 'Status' }
		]
	},
	{
		key: 'ortu',
		judul: 'Orang Tua & Wali',
		deskripsi: 'Data orang tua/wali murid (ayah, ibu, wali) beserta pekerjaan dan kontak.',
		ikon: 'users',
		tabel: 'wali_murid',
		fields: [
			{ key: 'nama', label: 'Nama', tipe: 'teks', wajib: true },
			{ key: 'pekerjaan', label: 'Pekerjaan', tipe: 'teks', default: '-' },
			{ key: 'kontak', label: 'Kontak / No. HP', tipe: 'teks' },
			{ key: 'alamat', label: 'Alamat', tipe: 'textarea' }
		],
		kolom: [
			{ key: 'nama', label: 'Nama' },
			{ key: 'pekerjaan', label: 'Pekerjaan' },
			{ key: 'kontak', label: 'Kontak' },
			{ key: 'alamat', label: 'Alamat' }
		]
	},
	{
		key: 'sekolah',
		judul: 'Profil Sekolah',
		deskripsi: 'Identitas sekolah, jenjang pendidikan, dan kriteria penilaian rapor.',
		ikon: 'school',
		tabel: 'sekolah',
		fields: [
			{ key: 'nama', label: 'Nama Sekolah', tipe: 'teks', wajib: true },
			{ key: 'npsn', label: 'NPSN', tipe: 'teks', wajib: true },
			{ key: 'email', label: 'Email Sekolah', tipe: 'teks' },
			{ key: 'website', label: 'Website', tipe: 'teks' },
			{
				key: 'jenjang_pendidikan',
				label: 'Jenjang Pendidikan',
				tipe: 'pilihan',
				wajib: true,
				opsi: [
					{ label: 'SMA', value: 'sma' },
					{ label: 'SMP', value: 'smp' },
					{ label: 'SD', value: 'sd' },
					{ label: 'SLB', value: 'slb' },
					{ label: 'PKBM', value: 'pkbm' },
					{ label: 'SRT', value: 'srt' }
				]
			},
			{
				key: 'jenjang_variant',
				label: 'Varian Jenjang',
				tipe: 'teks',
				placeholder: 'Teknik / Rekayasa'
			},
			{ key: 'rapor_kriteria_cukup', label: 'Ambang Kriteria Cukup', tipe: 'angka', default: 85 },
			{ key: 'rapor_kriteria_baik', label: 'Ambang Kriteria Baik', tipe: 'angka', default: 95 },
			{
				key: 'status_kepala_sekolah',
				label: 'Status Kepala Sekolah',
				tipe: 'pilihan',
				opsi: [
					{ label: 'Definitif', value: 'definitif' },
					{ label: 'PLT (Pelaksana Tugas)', value: 'plt' }
				]
			}
		],
		kolom: [
			{ key: 'nama', label: 'Nama Sekolah' },
			{ key: 'npsn', label: 'NPSN' },
			{ key: 'jenjang_pendidikan', label: 'Jenjang' },
			{ key: 'jenjang_variant', label: 'Varian' },
			{ key: 'email', label: 'Email' }
		]
	}
];

export function cariMasterData(key: string) {
	return MASTER_DATA.find((item) => item.key === key);
}
