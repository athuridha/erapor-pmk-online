/**
 * Daftar modul yang dikelola admin di Dashboard Admin.
 *
 * Setiap modul menunjuk ke halaman "kelola" (daftar/data) dan, bila ada,
 * halaman "tambah" (form create). Jumlah data pada tiap modul diambil dari
 * database saat halaman dimuat — tidak ada angka yang ditulis manual.
 */
export interface ModulAdmin {
	key: string;
	judul: string;
	deskripsi: string;
	ikon: IconName;
	kelola: string;
	tambah?: string;
	kelompok: string;
	tags: string[];
}

export const KELOMPOK_MODUL = [
	'Induk Data Sekolah',
	'Mata Pelajaran & Guru',
	'Penilaian',
	'Kehadiran & Aktivitas',
	'Administrasi & Pengaturan'
] as const;

export const modulAdmin: ModulAdmin[] = [
	{
		key: 'sekolah',
		judul: 'Data Sekolah',
		deskripsi: 'Profil sekolah, logo, kepala sekolah, dan data alamat.',
		ikon: 'school',
		kelola: '/sekolah',
		tambah: '/sekolah/form',
		kelompok: 'Induk Data Sekolah',
		tags: ['sekolah', 'profil', 'logo', 'kepala sekolah', 'npsn']
	},
	{
		key: 'tahun_ajaran',
		judul: 'Tahun Ajaran & Semester',
		deskripsi: 'Kalender pendidikan: tahun ajaran, semester ganjil/genap, tanggal rapor.',
		ikon: 'calendar',
		kelola: '/sekolah/tahun-ajaran',
		kelompok: 'Induk Data Sekolah',
		tags: ['tahun ajaran', 'semester', 'ganjil', 'genap', 'kalender']
	},
	{
		key: 'akademik',
		judul: 'Akademik',
		deskripsi: 'Semester aktif, pengaturan sekolah, dan sinkronisasi data Dapodik.',
		ikon: 'gear',
		kelola: '/akademik',
		kelompok: 'Induk Data Sekolah',
		tags: ['akademik', 'pengaturan', 'dapodik', 'sinkron']
	},
	{
		key: 'kelas',
		judul: 'Kelas / Rombel',
		deskripsi: 'Rombongan belajar, wali kelas, wali asuh, dan jenjang.',
		ikon: 'users',
		kelola: '/kelas',
		tambah: '/kelas/form',
		kelompok: 'Induk Data Sekolah',
		tags: ['kelas', 'rombel', 'wali kelas', 'wali asuh']
	},
	{
		key: 'murid',
		judul: 'Murid',
		deskripsi: 'Data siswa, orang tua, arsip berkas, dan pemindahan kelas.',
		ikon: 'user',
		kelola: '/murid',
		tambah: '/murid/form',
		kelompok: 'Induk Data Sekolah',
		tags: ['murid', 'siswa', 'orang tua', 'arsip', 'pindah kelas']
	},
	{
		key: 'intrakurikuler',
		judul: 'Mata Pelajaran (Intrakurikuler)',
		deskripsi: 'Daftar mapel wajib, KKM, urutan, guru pengampu, dan tujuan pembelajaran.',
		ikon: 'book',
		kelola: '/intrakurikuler',
		tambah: '/intrakurikuler/form',
		kelompok: 'Mata Pelajaran & Guru',
		tags: ['mapel', 'mata pelajaran', 'intrakurikuler', 'kkm', 'tp', 'tujuan pembelajaran']
	},
	{
		key: 'kokurikuler',
		judul: 'Kokurikuler',
		deskripsi: 'Kegiatan kokurikuler per kelas beserta dimensi penilaiannya.',
		ikon: 'layers',
		kelola: '/kokurikuler',
		kelompok: 'Mata Pelajaran & Guru',
		tags: ['kokurikuler', 'kegiatan', 'projek']
	},
	{
		key: 'ekstrakurikuler',
		judul: 'Ekstrakurikuler',
		deskripsi: 'Kegiatan ekstrakurikuler, tujuan, dan kategori nilai.',
		ikon: 'star',
		kelola: '/ekstrakurikuler',
		kelompok: 'Mata Pelajaran & Guru',
		tags: ['ekstrakurikuler', 'ekskul', 'kegiatan']
	},
	{
		key: 'pengguna',
		judul: 'Pengguna & Hak Akses',
		deskripsi: 'Akun guru, kepala sekolah, admin, wali kelas, dan izinnya.',
		ikon: 'key',
		kelola: '/pengguna',
		tambah: '/pengguna/form',
		kelompok: 'Mata Pelajaran & Guru',
		tags: ['pengguna', 'akun', 'guru', 'admin', 'izin', 'permission', 'password']
	},
	{
		key: 'asesmen_formatif',
		judul: 'Asesmen Formatif',
		deskripsi: 'Nilai formatif harian per murid dan tujuan pembelajaran.',
		ikon: 'pen',
		kelola: '/asesmen-formatif',
		tambah: '/asesmen-formatif/formulir-asesmen',
		kelompok: 'Penilaian',
		tags: ['formatif', 'nilai', 'harian', 'asesmen']
	},
	{
		key: 'asesmen_sumatif',
		judul: 'Asesmen Sumatif',
		deskripsi: 'Nilai sumatif lingkup/STS/SAS dan nilai akhir per mapel.',
		ikon: 'pen',
		kelola: '/asesmen-sumatif',
		tambah: '/asesmen-sumatif/formulir-asesmen',
		kelompok: 'Penilaian',
		tags: ['sumatif', 'sts', 'sas', 'nilai akhir', 'asesmen']
	},
	{
		key: 'asesmen_kokurikuler',
		judul: 'Nilai Kokurikuler',
		deskripsi: 'Penilaian kokurikuler per dimensi kegiatan.',
		ikon: 'check',
		kelola: '/asesmen-kokurikuler',
		kelompok: 'Penilaian',
		tags: ['nilai kokurikuler', 'dimensi', 'kategori']
	},
	{
		key: 'nilai_ekstrakurikuler',
		judul: 'Nilai Ekstrakurikuler',
		deskripsi: 'Penilaian kegiatan ekstrakurikuler per murid.',
		ikon: 'check',
		kelola: '/nilai-ekstrakurikuler',
		tambah: '/nilai-ekstrakurikuler/form-asesmen',
		kelompok: 'Penilaian',
		tags: ['nilai ekstrakurikuler', 'ekskul']
	},
	{
		key: 'nilai_akhir',
		judul: 'Rekap Nilai Akhir',
		deskripsi: 'Rekap nilai akhir kelas aktif dan kirim nilai ke Dapodik.',
		ikon: 'chart',
		kelola: '/nilai-akhir',
		kelompok: 'Penilaian',
		tags: ['rekap nilai', 'nilai akhir', 'dapodik', 'matev']
	},
	{
		key: 'rekap_keseluruhan',
		judul: 'Rekap Nilai Keseluruhan',
		deskripsi: 'Nilai murid lintas semester, dari kelas pertama sampai kelas terakhir.',
		ikon: 'chart',
		kelola: '/nilai-akhir/rekap-keseluruhan',
		kelompok: 'Penilaian',
		tags: ['rekap', 'lintas semester', 'seluruh', 'dashboard nilai']
	},
	{
		key: 'presensi_murid',
		judul: 'Presensi Murid',
		deskripsi: 'Rekap kehadiran, sakit, izin, dan alfa murid per bulan.',
		ikon: 'check-square',
		kelola: '/presensi-murid',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['presensi', 'absen', 'hadir', 'sakit', 'izin', 'alfa', 'murid']
	},
	{
		key: 'presensi_guru',
		judul: 'Presensi Guru',
		deskripsi: 'Kehadiran guru harian, lengkap dengan paraf dan rekap bulanan.',
		ikon: 'check-square',
		kelola: '/presensi-guru',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['presensi guru', 'absen guru', 'paraf']
	},
	{
		key: 'jadwal',
		judul: 'Jadwal Pelajaran',
		deskripsi: 'Jam pelajaran, bell, dan pembagian tugas guru.',
		ikon: 'calendar',
		kelola: '/jadwal-pelajaran',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['jadwal', 'jam pelajaran', 'bell']
	},
	{
		key: 'jurnal',
		judul: 'Jurnal Mengajar',
		deskripsi: 'Jurnal mengajar guru per pertemuan kelas.',
		ikon: 'book-open',
		kelola: '/jurnal-mengajar',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['jurnal', 'mengajar', 'guru']
	},
	{
		key: 'catatan_wali',
		judul: 'Catatan Wali Kelas',
		deskripsi: 'Catatan accompanyement dan Tempel wali kelas per murid.',
		ikon: 'edit',
		kelola: '/catatan-wali-kelas',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['catatan', 'wali kelas', 'semangat', 'tempel']
	},
	{
		key: 'keputusan',
		judul: 'Keputusan & Kenaikan Kelas',
		deskripsi: 'Status kelulusan dan kenaikan kelas murid.',
		ikon: 'success',
		kelola: '/keputusan',
		kelompok: 'Kehadiran & Aktivitas',
		tags: ['keputusan', 'naik kelas', 'lulus', 'kelulusan']
	},
	{
		key: 'tanda_tangan',
		judul: 'Tanda Tangan',
		deskripsi: 'Pas digital guru, kepala sekolah, dan murid.',
		ikon: 'pen',
		kelola: '/tanda-tangan',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['tanda tangan', 'paraf', 'ttd', 'signature']
	},
	{
		key: 'portal',
		judul: 'Portal Orang Tua',
		deskripsi: 'Akun orang tua, tautan murid, dan publikasi ke portal.',
		ikon: 'users',
		kelola: '/portal-orang-tua',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['portal', 'orang tua', 'publish', 'akun']
	},
	{
		key: 'sinkronisasi',
		judul: 'Sinkronisasi Cloud',
		deskripsi: 'Pengaturan D1 Cloudflare, paket data, dan log sinkronisasi.',
		ikon: 'database',
		kelola: '/sinkronisasi',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['sinkronisasi', 'cloudflare', 'd1', 'backup']
	},
	{
		key: 'cetak',
		judul: 'Cetak Dokumen',
		deskripsi: 'Cetak rapor, cover, biodata, dan piagam.',
		ikon: 'print',
		kelola: '/cetak',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['cetak', 'rapor', 'cover', 'biodata', 'piagam', 'pdf']
	},
	{
		key: 'sppd',
		judul: 'SPPD',
		deskripsi: 'Surat Perintah Perjalanan Dinas beserta pengikutnya.',
		ikon: 'folder',
		kelola: '/sppd',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['sppd', 'perjalanan', 'dinas', 'surat']
	},
	{
		key: 'dinas_luar',
		judul: 'Dinas Luar',
		deskripsi: 'Permohonan dan bukti kegiatan dinas luar.',
		ikon: 'folder',
		kelola: '/dinas-luar',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['dinas luar', 'permohonan', 'bukti']
	},
	{
		key: 'buku_tamu',
		judul: 'Buku Tamu',
		deskripsi: 'Pencatatan tamu sekolah beserta tanda tangannya.',
		ikon: 'users',
		kelola: '/buku-tamu',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['buku tamu', 'tamu', 'kunjungan']
	},
	{
		key: 'pengaturan',
		judul: 'Pengaturan',
		deskripsi: 'Profil sekolah, hak akses, dan preferensi aplikasi.',
		ikon: 'gear',
		kelola: '/pengaturan',
		kelompok: 'Administrasi & Pengaturan',
		tags: ['pengaturan', 'profil', 'preferensi', 'aplikasi']
	}
];
