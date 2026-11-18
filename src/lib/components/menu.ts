export const appMenuItems: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'statistik', 'ringkasan', 'home', 'beranda']
	},
	{
		title: 'Sekolah & Kelas',
		icon: 'school',
		subMenu: [
			{
				title: 'Identitas Sekolah',
				path: '/sekolah',
				tags: ['sekolah', 'dapodik', 'ambil data', 'tarik', 'sinkron']
			},
			{
				title: 'Akademik & Jadwal',
				path: '/akademik',
				tags: ['akademik', 'jadwal', 'bell', 'sound']
			},
			{
				title: 'Semua Kelas',
				path: '/semua-kelas',
				tags: ['rekap', 'ringkasan', 'overview', 'seluruh kelas', 'guru', 'murid', 'pindah']
			},
			{
				title: 'Kelola Kelas',
				path: '/kelas',
				tags: ['rombel', 'kelas', 'kelola', 'tambah', 'hapus']
			},
			{
				title: 'Data Murid',
				path: '/murid',
				tags: ['murid', 'siswa', 'rombel']
			}
		]
	},
	{
		title: 'Kurikulum & Mapel',
		icon: 'book',
		subMenu: [
			{
				title: 'Intrakurikuler',
				path: '/intrakurikuler',
				tags: ['tujuan pembelajaran', 'lingkup materi', 'tp', 'mapel', 'mata pelajaran']
			},
			{
				title: 'Kokurikuler',
				path: '/kokurikuler',
				tags: ['kokurikuler', 'mapel']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul', 'tp']
			},
			{
				title: 'Teknik Penilaian',
				path: '/teknik-penilaian',
				tags: ['teknik', 'penilaian', 'asesmen', 'tes tulis', 'kinerja', 'portofolio', 'metode']
			}
		]
	},
	{
		title: 'Input Nilai',
		icon: 'pen',
		subMenu: [
			{
				title: 'Asesmen Formatif',
				path: '/asesmen-formatif',
				tags: ['nilai', 'formatif', 'intrakurikuler']
			},
			{
				title: 'Asesmen Sumatif',
				path: '/asesmen-sumatif',
				tags: ['nilai', 'sumatif', 'sts', 'sas', 'intrakurikuler']
			},
			{
				title: 'Kokurikuler',
				path: '/asesmen-kokurikuler',
				tags: ['nilai', 'kokurikuler']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler',
				tags: ['nilai', 'ekstrakurikuler', 'ekskul']
			},
			{
				title: 'P5 (Projek Pancasila)',
				path: '/p5',
				tags: ['p5', 'projek', 'pancasila', 'dimensi', 'pembina', 'rapor']
			},
			{
				title: 'PKL (Prakerin)',
				path: '/prakerin',
				tags: ['pkl', 'prakerin', 'magang', 'perusahaan', 'kelompok', 'pembimbing', 'rapor']
			},
			{
				title: 'Kunci Nilai',
				path: '/kunci-nilai',
				tags: ['nilai', 'kunci', 'terkunci', 'operator']
			}
		]
	},
	{
		title: 'Administrasi & Rapor',
		icon: 'briefcase',
		subMenu: [
			{
				title: 'Presensi Murid',
				path: '/presensi-murid',
				tags: ['presensi', 'absen', 'kehadiran', 'murid']
			},
			{
				title: 'Jurnal Mengajar',
				path: '/jurnal-mengajar',
				tags: ['jurnal', 'mengajar', 'materi']
			},
			{
				title: 'RPM',
				path: '/rpm',
				tags: ['rpm', 'rencana pembelajaran', 'mendalam', 'deep learning', 'kurikulum merdeka']
			},
			{
				title: 'Catatan Wali Kelas',
				path: '/catatan-wali-kelas',
				tags: ['catatan', 'wali kelas', 'rapor']
			},
			{
				title: 'Rekap Nilai',
				path: '/nilai-akhir',
				tags: ['kirim', 'matev', 'nilai', 'dapodik']
			},
			{
				title: 'Legger',
				path: '/legger',
				tags: ['legger', 'leger', 'nilai akhir', 'rekap', 'excel']
			},
			{
				title: 'Keputusan',
				path: '/keputusan',
				tags: ['kenaikan', 'kelas', 'lulus', 'naik'],
				condition: 'genap'
			},
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'tata tertib', 'siswa', 'riwayat']
			},
			{
				title: 'Impor Data',
				path: '/impor',
				tags: ['import', 'impor', 'excel', 'data pokok', 'murid', 'kelas', 'pegawai', 'nilai']
			},
			{
				title: 'Jejak Audit',
				path: '/audit',
				tags: ['audit', 'jejak', 'riwayat', 'nilai', 'perubahan']
			}
		]
	},
	{
		title: 'Layanan & Kepegawaian',
		icon: 'users',
		subMenu: [
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
				title: 'Dinas Luar (SPPD)',
				path: '/sppd',
				tags: ['sppd', 'dinas', 'luar', 'perjalanan', 'surat', 'perintah']
			},
			{
				title: 'Permohonan Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas', 'luar', 'perjalanan', 'permohonan', 'undangan']
			},
			{
				title: 'Buku Tamu',
				path: '/buku-tamu',
				tags: ['tamu', 'kunjungan', 'buku']
			},
			{
				title: 'Portal Orang Tua',
				path: '/portal-orang-tua',
				tags: ['portal', 'orang tua', 'wali', 'akun', 'password', 'publikasi']
			}
		]
	},
	{
		title: 'Cetak',
		icon: 'print',
		subMenu: [
			{
				title: 'Cetak Dokumen',
				path: '/cetak',
				tags: ['cetak', 'pdf', 'rapor', 'piagam', 'biodata', 'cover', 'jurnal']
			},
			{
				title: 'Kustomisasi Cetak',
				path: '/cetak/kustomisasi',
				tags: ['kustomisasi', 'cetak', 'template', 'logo', 'kop', 'watermark', 'layout', 'jarak']
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
				title: 'Guru Pengampu',
				path: '/master-data/pengampu',
				tags: ['guru pengampu', 'pengampu', 'pembagian tugas', 'guru mapel', 'plotting']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/master-data/ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul', 'extracurricular', 'anggota', 'referensi']
			},
			{
				title: 'Akun Pengguna',
				path: '/master-data/pengguna',
				tags: [
					'pengguna',
					'akun',
					'guru',
					'operator',
					'admin',
					'kepala sekolah',
					'wali kelas',
					'wali asuh',
					'pembina eskul',
					'user'
				]
			},
			{
				title: 'Orang Tua & Wali',
				path: '/master-data/ortu',
				tags: ['orang tua', 'wali', 'ayah', 'ibu', 'referensi']
			},
			{
				title: 'Bobot Penilaian',
				path: '/master-data/bobot',
				tags: ['bobot', 'penilaian', 'sumatif', 'sts', 'sas', 'lingkup', 'rts']
			},
			{
				title: 'Profil Sekolah',
				path: '/master-data/sekolah',
				tags: ['sekolah', 'profil', 'kriteria', 'referensi']
			}
		]
	}
];

export const menuModulGuru: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'home', 'beranda']
	},
	{
		title: 'Perencanaan & Mapel',
		icon: 'book',
		subMenu: [
			{
				title: 'Capaian Kompetensi & TP',
				path: '/intrakurikuler',
				tags: ['tujuan pembelajaran', 'lingkup materi', 'tp', 'mapel', 'mata pelajaran']
			},
			{
				title: 'Teknik Penilaian',
				path: '/teknik-penilaian',
				tags: ['teknik', 'penilaian', 'asesmen', 'metode']
			},
			{
				title: 'Rencana Pembelajaran (RPM)',
				path: '/rpm',
				tags: ['rpm', 'rencana pembelajaran', 'deep learning']
			}
		]
	},
	{
		title: 'Penilaian Mapel',
		icon: 'pen',
		subMenu: [
			{
				title: 'Asesmen Formatif',
				path: '/asesmen-formatif',
				tags: ['formatif', 'tugas', 'kuis', 'nilai']
			},
			{
				title: 'Asesmen Sumatif',
				path: '/asesmen-sumatif',
				tags: ['sumatif', 'sts', 'sas', 'ulangan', 'nilai']
			},
			{
				title: 'Nilai Akhir Mapel',
				path: '/nilai-akhir',
				tags: ['nilai akhir', 'deskripsi', 'rapor', 'rekap']
			}
		]
	},
	{
		title: 'Pengajaran & Kehadiran',
		icon: 'check',
		subMenu: [
			{
				title: 'Presensi Murid',
				path: '/presensi-murid',
				tags: ['presensi', 'absen', 'kehadiran', 'mapel', 'siswa']
			},
			{
				title: 'Jurnal Mengajar',
				path: '/jurnal-mengajar',
				tags: ['jurnal', 'materi', 'pertemuan']
			},
			{
				title: 'Cetak Jurnal Mengajar',
				path: '/cetak',
				tags: ['cetak', 'jurnal mengajar', 'pdf']
			},
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'prestasi', 'tata tertib']
			}
		]
	},
	{
		title: 'Kepegawaian',
		icon: 'briefcase',
		subMenu: [
			{
				title: 'Presensi Guru',
				path: '/presensi-guru',
				tags: ['presensi', 'kehadiran', 'guru']
			},
			{
				title: 'Permohonan Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas luar', 'tugas', 'permohonan']
			}
		]
	}
];

export const menuModulWaliKelas: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'home', 'beranda']
	},
	{
		title: 'Manajemen Kelas',
		icon: 'users',
		subMenu: [
			{
				title: 'Data Murid',
				path: '/murid',
				tags: ['murid', 'siswa', 'data induk', 'kelas']
			},
			{
				title: 'Presensi Murid',
				path: '/presensi-murid',
				tags: ['presensi', 'absen', 'kehadiran', 'harian', 'bulanan', 'rapor']
			},
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'prestasi', 'tata tertib']
			},
			{
				title: 'Catatan Wali Kelas',
				path: '/catatan-wali-kelas',
				tags: ['catatan', 'wali kelas', 'motivasi', 'rapor']
			},
			{
				title: 'Prakerin (PKL)',
				path: '/prakerin',
				tags: ['pkl', 'prakerin', 'magang']
			},
			{
				title: 'Keputusan Naik / Lulus',
				path: '/keputusan',
				tags: ['keputusan', 'kenaikan', 'lulus', 'naik kelas'],
				condition: 'genap'
			}
		]
	},
	{
		title: 'Nilai & Kokurikuler',
		icon: 'chart',
		subMenu: [
			{
				title: 'Rekap Nilai Kelas',
				path: '/nilai-akhir',
				tags: ['rekap', 'nilai akhir', 'rapor']
			},
			{
				title: 'Legger',
				path: '/legger',
				tags: ['legger', 'leger', 'nilai akhir', 'rekap', 'siswa']
			},
			{
				title: 'Urutan Mapel Kelas',
				path: '/intrakurikuler',
				tags: ['urutan', 'mapel', 'intrakurikuler', 'rapor']
			},
			{
				title: 'Kokurikuler',
				path: '/kokurikuler',
				tags: ['kokurikuler', 'kegiatan']
			},
			{
				title: 'Asesmen Kokurikuler',
				path: '/asesmen-kokurikuler',
				tags: ['asesmen', 'kokurikuler', 'nilai']
			},
			{
				title: 'Projek P5',
				path: '/p5',
				tags: ['p5', 'projek', 'pancasila']
			},
			{
				title: 'Ekstrakurikuler',
				path: '/ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul']
			},
			{
				title: 'Nilai Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul', 'nilai']
			}
		]
	},
	{
		title: 'Rapor & Cetak',
		icon: 'print',
		subMenu: [
			{
				title: 'Daftar & Cetak Rapor',
				path: '/cetak',
				tags: ['cetak', 'rapor', 'pdf', 'piagam', 'biodata', 'cover']
			},
			{
				title: 'Tanda Tangan',
				path: '/tanda-tangan',
				tags: ['tanda tangan', 'paraf', 'ttd']
			}
		]
	},
	{
		title: 'Kepegawaian',
		icon: 'briefcase',
		subMenu: [
			{
				title: 'Presensi Guru',
				path: '/presensi-guru',
				tags: ['presensi', 'guru']
			},
			{
				title: 'Permohonan Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas luar', 'tugas', 'permohonan']
			}
		]
	}
];

export const menuModulPembinaEskul: MenuItem[] = [
	{
		title: 'Beranda',
		icon: 'grid',
		path: '/',
		tags: ['dashboard', 'home', 'beranda']
	},
	{
		title: 'Pembinaan Ekstrakurikuler',
		icon: 'layers',
		subMenu: [
			{
				title: 'Ekstrakurikuler & TP',
				path: '/ekstrakurikuler',
				tags: ['ekstrakurikuler', 'eskul', 'tujuan pembelajaran', 'tp']
			},
			{
				title: 'Input Nilai Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler',
				tags: ['nilai', 'ekstrakurikuler', 'eskul', 'asesmen']
			}
		]
	}
];
