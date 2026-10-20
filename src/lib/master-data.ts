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
	default?: string | number | boolean;
}

export interface MasterData {
	key: string;
	judul: string;
	deskripsi: string;
	ikon: 'calendar' | 'layers' | 'users' | 'book' | 'user' | 'school';
	/** Nama tabel di database (untuk pesan hapus). */
	tabel: string;
	fields: FieldMaster[];
	/** Kolom yang ditampilkan di tabel. */
	kolom: Array<{ key: string; label: string }>;
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
			{ key: 'kelas_id', label: 'Kelas', tipe: 'relasi', relasi: 'kelas', wajib: true },
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
			{ key: 'kelas', label: 'Kelas' },
			{ key: 'jenis', label: 'Jenis' },
			{ key: 'kkm', label: 'KKM' },
			{ key: 'pengampu', label: 'Guru Pengampu' }
		]
	},
	{
		key: 'pegawai',
		judul: 'Guru & Pegawai',
		deskripsi:
			'Data guru/pegawai dan NIP/NIK untuk login. Jabatan & golongan diatur di profil akun pengguna.',
		ikon: 'user',
		tabel: 'pegawai',
		fields: [
			{ key: 'nama', label: 'Nama', tipe: 'teks', wajib: true },
			{ key: 'nip', label: 'NIP', tipe: 'teks', wajib: true },
			{
				key: 'nik',
				label: 'NIK (untuk login guru)',
				tipe: 'teks',
				bantu: '16 digit, dipakai guru untuk login.'
			},
			{ key: 'nuptk', label: 'NUPTK', tipe: 'teks' },
			{ key: 'dapodik_ptk_id', label: 'ID PTK Dapodik', tipe: 'teks' }
		],
		kolom: [
			{ key: 'nama', label: 'Nama' },
			{ key: 'nip', label: 'NIP' },
			{ key: 'nik', label: 'NIK' },
			{ key: 'nuptk', label: 'NUPTK' }
		]
	},
	{
		key: 'sekolah',
		judul: 'Profil & Konfigurasi Sekolah',
		deskripsi:
			'Identitas sekolah, bobot penilaian sumatif, dan ambang kriteria rapor. Semua dipakai otomatis saat menghitung nilai.',
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
			{ key: 'sumatif_bobot_lingkup', label: 'Bobot Lingkup (%)', tipe: 'angka', default: 60 },
			{ key: 'sumatif_bobot_sts', label: 'Bobot STS (%)', tipe: 'angka', default: 20 },
			{ key: 'sumatif_bobot_sas', label: 'Bobot SAS (%)', tipe: 'angka', default: 20 },
			{
				key: 'sumatif_bobot_rts_lingkup',
				label: 'Bobot Lingkup RTS (%)',
				tipe: 'angka',
				default: 70
			},
			{ key: 'sumatif_bobot_rts_sts', label: 'Bobot STS RTS (%)', tipe: 'angka', default: 30 },
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
