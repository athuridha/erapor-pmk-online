export const appMenuItems: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'statistik', 'ringkasan', 'home', 'beranda']
	},
	{
		title: 'Wali Kelas',
		icon: 'school',
		// Konteks kelas = kelas wali (kelasAktif). Isi menu dipangkas per izin
		// di menu.svelte — akun non-wali otomatis kehilangan sub wali kelas.
		subMenu: [
			{
				title: 'Presensi Murid',
				path: '/presensi-murid',
				tags: ['absen', 'hadir', 'sakit', 'izin', 'alfa']
			},
			{
				title: 'Catatan Wali Kelas',
				path: '/catatan-wali-kelas',
				tags: ['catatan', 'perkembangan', 'anekdot', 'wali']
			},
			{
				title: 'Rekap Nilai',
				path: '/nilai-akhir',
				tags: ['kirim', 'matev', 'nilai', 'dapodik']
			},
			{
				title: 'Impor Nilai',
				path: '/nilai-akhir/impor-nilai',
				tags: ['impor', 'excel', 'nilai', 'bulk', 'murid']
			},
			{
				title: 'Keputusan',
				path: '/keputusan',
				tags: ['kenaikan', 'kelas', 'lulus', 'naik'],
				condition: 'genap'
			},
			{
				title: 'RPM',
				path: '/rpm',
				tags: ['rpm', 'rencana pembelajaran', 'mendalam', 'deep learning', 'kurikulum merdeka']
			},
			{
				title: 'Jurnal Mengajar',
				path: '/jurnal-mengajar',
				tags: ['jurnal', 'mengajar', 'guru', 'kegiatan']
			}
		]
	},
	{
		title: 'Mata Pelajaran',
		icon: 'book',
		// Konteks kelas = kelas yang diampu guru (pemilih kelas di halaman, bukan
		// kelasAktif global). Admin masih boleh lewat kelasAktif.
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
				title: 'Asesmen Kokurikuler',
				path: '/asesmen-kokurikuler',
				tags: ['asesmen', 'kokurikuler', 'nilai']
			},
			{
				title: 'Kelola Ekstrakurikuler',
				path: '/ekstrakurikuler',
				tags: ['ekskul', 'ekstrakurikuler', 'kelompok', 'pembina', 'anggota']
			},
			{
				title: 'Formatif',
				path: '/asesmen-formatif',
				tags: ['asesmen', 'nilai', 'rujukan']
			},
			{
				title: 'Sumatif',
				path: '/asesmen-sumatif',
				tags: ['asesmen', 'nilai', 'beda hari']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler',
				tags: ['ekskul', 'ekstrakurikuler', 'pembina', 'kelompok']
			}
		]
	},
	{
		title: 'Cetak Dokumen',
		icon: 'print',
		subMenu: [
			{
				title: 'Cetak Dokumen',
				path: '/cetak',
				tags: ['cetak', 'pdf', 'rapor', 'piagam', 'biodata', 'cover', 'jurnal']
			},
			{
				title: 'Kustomisasi',
				path: '/cetak/kustomisasi',
				tags: ['kustomisasi', 'cetak', 'template', 'logo', 'kop', 'watermark', 'layout', 'jarak']
			}
		]
	},
	{
		title: 'Administrasi',
		icon: 'briefcase',
		subMenu: [
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
			},
			{
				title: 'Jejak Audit',
				path: '/audit',
				tags: ['audit', 'jejak', 'riwayat', 'nilai', 'perubahan']
			},
			{
				title: 'Portal Orang Tua',
				path: '/portal-orang-tua',
				tags: ['portal', 'orang tua', 'wali', 'akun', 'password', 'publikasi']
			}
		]
	},
	{
		title: 'Sinkronisasi',
		icon: 'repeat',
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
		title: 'Master Data',
		icon: 'database',
		subMenu: [
			{
				title: 'Tahun Ajaran',
				path: '/master-data/tahun_ajaran',
				tags: ['tahun ajaran', 'kalender', 'referensi']
			},
			{
				title: 'Semester',
				path: '/master-data/semester',
				tags: ['semester', 'ganjil', 'genap', 'referensi']
			},
			{
				title: 'Kelas',
				path: '/master-data/kelas',
				tags: ['kelas', 'rombel', 'wali kelas', 'referensi']
			},
			{
				title: 'Murid',
				path: '/master-data/murid',
				tags: ['murid', 'siswa', 'data induk', 'referensi']
			},
			{
				title: 'Mata Pelajaran',
				path: '/master-data/mata_pelajaran',
				tags: ['mapel', 'mata pelajaran', 'kkm', 'pengampu', 'referensi']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/master-data/ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul', 'extracurricular', 'anggota', 'referensi']
			},
			{
				title: 'Data Pengguna',
				subMenu: [
					{
						title: 'Guru',
						path: '/master-data/pengguna/guru',
						tags: ['guru', 'pengajar', 'wali kelas', 'wali asuh', 'akun', 'pengguna']
					},
					{
						title: 'Operator',
						path: '/master-data/pengguna/operator',
						tags: ['operator', 'admin', 'kepala sekolah', 'akun', 'pengguna']
					}
				]
			},
			{
				title: 'Orang Tua & Wali',
				path: '/master-data/ortu',
				tags: ['orang tua', 'wali', 'ayah', 'ibu', 'referensi']
			},
			{
				title: 'Profil & Konfigurasi',
				path: '/master-data/sekolah',
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
			},
			{
				title: 'Kunci Nilai',
				path: '/kunci-nilai',
				tags: ['nilai', 'kunci', 'terkunci', 'operator']
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
				tags: ['impor', 'excel', 'nilai', 'bulk', 'murid']
			},
			{
				title: 'Jejak Audit',
				path: '/audit',
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
		subMenu: [
			{
				title: 'Cetak Dokumen',
				path: '/cetak',
				tags: ['cetak', 'pdf', 'rapor', 'piagam', 'biodata', 'cover', 'jurnal']
			},
			{
				title: 'Kustomisasi',
				path: '/cetak/kustomisasi',
				tags: ['kustomisasi', 'cetak', 'template', 'logo', 'kop', 'watermark', 'layout', 'jarak']
			}
		]
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
b51018c (feat: worker proxy database pusat, launcher update wajib, dan perbaikan sinkronisasi)
	}
];
