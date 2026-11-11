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
				title: 'Kelola Kelas',
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
				title: 'Teknik Penilaian',
				path: '/teknik-penilaian',
				tags: ['teknik', 'penilaian', 'asesmen', 'tes tulis', 'kinerja', 'portofolio', 'metode']
			},
			{
				title: 'Kokurikuler',
				path: '/kokurikuler'
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
				title: 'Impor',
				path: '/impor',
				tags: ['import', 'impor', 'excel', 'data pokok', 'murid', 'kelas', 'pegawai', 'nilai']
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
			},
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'tata tertib', 'siswa', 'riwayat']
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
		title: 'Cetak',
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
		title: 'Persiapan Penilaian',
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
			}
		]
	},
	{
		title: 'Penilaian',
		icon: 'pen',
		subMenu: [
			{
				title: 'Penilaian Formatif',
				path: '/asesmen-formatif',
				tags: ['formatif', 'tugas', 'kuis', 'nilai']
			},
			{
				title: 'Penilaian Sumatif',
				path: '/asesmen-sumatif',
				tags: ['sumatif', 'sts', 'sas', 'ulangan', 'nilai']
			},
			{
				title: 'Nilai Akhir & Deskripsi Rapor',
				path: '/nilai-akhir',
				tags: ['nilai akhir', 'deskripsi', 'rapor', 'rekap']
			},
			{
				title: 'Impor',
				path: '/impor',
				tags: ['impor', 'excel', 'nilai', 'bulk']
			}
		]
	},
	{
		title: 'Administrasi Guru',
		icon: 'briefcase',
		subMenu: [
			{
				title: 'Jurnal Mengajar',
				path: '/jurnal-mengajar',
				tags: ['jurnal', 'materi', 'pertemuan']
			},
			{
				title: 'RPM (Rencana Pembelajaran)',
				path: '/rpm',
				tags: ['rpm', 'rencana pembelajaran', 'deep learning']
			},
			{
				title: 'Presensi Guru',
				path: '/presensi-guru',
				tags: ['presensi', 'kehadiran', 'guru']
			},
			{
				title: 'Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas luar', 'tugas', 'permohonan']
			}
		]
	},
	{
		title: 'Fitur Tambahan',
		icon: 'star',
		subMenu: [
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'prestasi', 'tata tertib']
			},
			{
				title: 'Buku Tamu',
				path: '/buku-tamu',
				tags: ['tamu', 'kunjungan']
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
				title: 'Peserta Didik',
				path: '/murid',
				tags: ['murid', 'siswa', 'data induk', 'kelas']
			},
			{
				title: 'Absensi Murid',
				path: '/presensi-murid',
				tags: ['presensi', 'absen', 'kehadiran', 'harian', 'bulanan']
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
				title: 'Pengaturan Naik Kelas',
				path: '/keputusan',
				tags: ['keputusan', 'kenaikan', 'lulus', 'naik kelas'],
				condition: 'genap'
			}
		]
	},
	{
		title: 'Monitor Penilaian',
		icon: 'chart',
		subMenu: [
			{
				title: 'Daftar Nilai / Rekap',
				path: '/nilai-akhir',
				tags: ['rekap', 'nilai akhir', 'rapor']
			},
			{
				title: 'Kokurikuler / P5',
				path: '/p5',
				tags: ['p5', 'projek', 'pancasila']
			},
			{
				title: 'Nilai Ekstrakurikuler',
				path: '/nilai-ekstrakurikuler',
				tags: ['ekstrakurikuler', 'ekskul', 'nilai']
			}
		]
	},
	{
		title: 'Rapor',
		icon: 'print',
		subMenu: [
			{
				title: 'Daftar & Cetak Rapor',
				path: '/cetak',
				tags: ['cetak', 'rapor', 'pdf', 'piagam', 'biodata']
			},
			{
				title: 'Tanda Tangan',
				path: '/tanda-tangan',
				tags: ['tanda tangan', 'paraf', 'ttd']
			}
		]
	},
	{
		title: 'Fitur Tambahan',
		icon: 'star',
		subMenu: [
			{
				title: 'Poin Siswa',
				path: '/poin-siswa',
				tags: ['poin', 'pelanggaran', 'prestasi', 'tata tertib']
			},
			{
				title: 'Presensi Guru',
				path: '/presensi-guru',
				tags: ['presensi', 'guru']
			},
			{
				title: 'Dinas Luar',
				path: '/dinas-luar',
				tags: ['dinas luar']
			}
		]
	}
];
