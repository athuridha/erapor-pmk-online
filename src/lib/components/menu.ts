export const appMenuItems: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'statistik', 'ringkasan', 'home', 'beranda']
	},
	{
		title: 'Master Data',
		icon: 'database',
		subMenu: [
			{
				title: 'Tahun Ajaran',
				path: '/master-data/tahun_ajaran',
				icon: 'calendar',
				tags: ['tahun ajaran', 'kalender', 'referensi']
			},
			{
				title: 'Semester',
				path: '/master-data/semester',
				icon: 'layers',
				tags: ['semester', 'ganjil', 'genap', 'referensi']
			},
			{
				title: 'Kelas',
				path: '/master-data/kelas',
				icon: 'users',
				tags: ['kelas', 'rombel', 'wali kelas', 'referensi']
			},
			{
				title: 'Murid',
				path: '/master-data/murid',
				icon: 'user',
				tags: ['murid', 'siswa', 'data induk', 'referensi']
			},
			{
				title: 'Mata Pelajaran',
				path: '/master-data/mata_pelajaran',
				icon: 'book',
				tags: ['mapel', 'mata pelajaran', 'kkm', 'pengampu', 'referensi']
			},
			{
				title: 'Guru & Pegawai',
				path: '/master-data/pengguna',
				icon: 'users',
				tags: ['guru', 'pegawai', 'nip', 'nik', 'referensi']
			},
			{
				title: 'Orang Tua & Wali',
				path: '/master-data/ortu',
				icon: 'users',
				tags: ['orang tua', 'wali', 'ayah', 'ibu', 'referensi']
			},
			{
				title: 'Profil & Konfigurasi',
				path: '/master-data/sekolah',
				icon: 'school',
				tags: ['sekolah', 'profil', 'bobot', 'kriteria', 'konfigurasi', 'referensi']
			}
		]
	},
	{
		title: 'Informasi Umum',
		icon: 'chart',
		subMenu: [
			{
				title: 'Sekolah',
				path: '/sekolah',
				tags: ['dapodik', 'ambil data', 'tarik', 'sinkron']
			},
			{
				title: 'Akademik',
				path: '/akademik',
				tags: ['jadwal', 'bell', 'sound']
			},
			{
				title: 'Kelas',
				subMenu: [
					{
						title: 'Kelas',
						path: '/kelas',
						tags: ['rombel', 'kelas', 'kelola', 'tambah', 'hapus']
					},
					{
						title: 'Semua Kelas',
						path: '/semua-kelas',
						tags: ['rekap', 'ringkasan', 'overview', 'seluruh kelas', 'guru', 'murid', 'pindah']
					}
				]
			},
			{
				title: 'Murid',
				path: '/murid'
			}
		]
	},
	{
		title: 'Mata Pelajaran',
		icon: 'book',
		subMenu: [
			{
				title: 'Intrakurikuler',
				path: '/intrakurikuler',
				tags: ['tujuan pembelajaran', 'lingkup materi', 'tp', 'mapel', 'mata pelajaran']
			},
			{
				title: 'Kokurikuler',
				path: '/kokurikuler'
			},
			{
				title: 'Ekstrakurikuler',
				path: '/ekstrakurikuler'
			}
		]
	},
	{
		title: 'Input Nilai',
		icon: 'pen',
		subMenu: [
			{
				title: 'Intrakurikuler',
				subMenu: [
					{
						title: 'Formatif',
						path: '/asesmen-formatif',
						tags: ['nilai']
					},
					{
						title: 'Sumatif',
						path: '/asesmen-sumatif',
						tags: ['nilai']
					}
				]
			},
			{
				title: 'Kokurikuler',
				path: '/asesmen-kokurikuler'
			},
			{
				title: 'Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler'
			}
		]
	},
	{
		title: 'Administrasi',
		icon: 'briefcase',
		subMenu: [
			{
				title: 'Presensi Murid',
				path: '/presensi-murid'
			},
			{
				title: 'RPM',
				path: '/rpm',
				tags: ['rpm', 'rencana pembelajaran', 'mendalam', 'deep learning', 'kurikulum merdeka']
			},
			{
				title: 'Jurnal Mengajar',
				path: '/jurnal-mengajar'
			},
			{
				title: 'Catatan Wali Kelas',
				path: '/catatan-wali-kelas'
			},
			{
				title: 'Rekap Nilai',
				path: '/nilai-akhir',
				tags: ['kirim', 'matev', 'nilai', 'dapodik']
			},
			{
				title: 'Impor Nilai',
				path: '/nilai-akhir/impor-nilai',
				icon: 'import',
				tags: ['impor', 'excel', 'nilai', 'bulk', 'murid']
			},
			{
				title: 'Jejak Audit',
				path: '/audit',
				icon: 'info',
				tags: ['audit', 'jejak', 'riwayat', 'nilai', 'perubahan']
			},
			{
				title: 'Keputusan',
				path: '/keputusan',
				tags: ['kenaikan', 'kelas', 'lulus', 'naik'],
				condition: 'genap'
			},
			{
				title: 'Buku Tamu',
				path: '/buku-tamu',
				tags: ['tamu', 'kunjungan', 'buku']
			},
			{
				title: 'Presensi Guru',
				path: '/presensi-guru',
				tags: ['presensi', 'guru', 'hadir', 'sakit', 'izin']
			},
			{
				title: 'Tanda Tangan',
				path: '/tanda-tangan',
				tags: ['tanda tangan', 'paraf', 'ttd', 'signature', 'kepala sekolah', 'wali kelas']
			},
			{
				title: 'Dinas Luar',
				path: '/sppd',
				tags: ['sppd', 'dinas', 'luar', 'perjalanan', 'surat', 'perintah']
			},
			{
				title: 'Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas', 'luar', 'perjalanan', 'permohonan', 'undangan']
			}
		]
	},
	{
		title: 'Portal Orang Tua',
		icon: 'users',
		path: '/portal-orang-tua',
		tags: ['portal', 'orang tua', 'wali', 'akun', 'password', 'publikasi']
	},
	{
		title: 'Cetak Dokumen',
		icon: 'print',
		path: '/cetak'
	},
	{
		title: 'Sinkronisasi',
		icon: 'database',
		subMenu: [
			{
				title: 'Database Pusat',
				path: '/sinkronisasi',
				tags: ['sinkron', 'sinkronisasi', 'database pusat', 'kirim nilai', 'ambil master']
			},
			{
				title: 'Impor Data',
				path: '/sinkronisasi/import-data',
				tags: ['import', 'impor', 'excel', 'data pokok', 'murid', 'kelas', 'pegawai']
			}
		]
	}
];
