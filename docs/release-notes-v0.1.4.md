e-Rapor SMK Pratama Mulya v0.1.4

Fitur baru
- Kustomisasi Cetak (/cetak/kustomisasi): ubah teks, gambar, dan jarak/layout dokumen cetak
  (nama sekolah/NPSN/alamat/email di kop, kota & tanggal penutup, judul/subjudul/catatan kaki
  per dokumen, baris kop seperti nama Kementerian, upload logo kop & watermark, margin, ukuran
  font, jarak baris, lebar logo, opasitas watermark, padding sel tabel).
  Dilengkapi live preview HTML yang sama persis dengan hasil PDF.
- Data Pengguna di Master Data dipisah jadi Guru & Operator, lengkap dengan CRUD di halaman
  sendiri: tambah akun via modal, hapus per baris & massal, rekap jumlah per role, plus import
  daftar guru dari Excel/CSV (kata sandi awal = username, wajib ganti sandi saat login pertama).
- Master Data punya entitas Ekstrakurikuler (nama + kelas, termasuk "Semua Kelas") dengan
  pengelolaan anggota (pindah murid antar panel, filter kelas, pencarian nama/NIS).
- Admin & Kepala Sekolah boleh berada di luar kelas ("Semua Kelas" di switcher navbar): halaman
  multi-kelas mengambil data dari semua kelas.
- Sidebar navigasi desktop selalu tampil di layar lebar, dan halaman Kustomisasi Cetak memakai
  ruang penuh (panel "Daftar tugas" & "Menu Favorit" disembunyikan).

Perbaikan
- Master Data: tombol tambah/ubah tidak lagi error 500 dan form tambah tidak ikut memakai isi
  baris pertama.
- Ekstrakurikuler umum (semua kelas) ikut tampil di halaman kelas dan input nilai.
- Installer tidak lagi menanamkan CLOUDFLARE_API_TOKEN secara otomatis (repo rilis bersifat
  publik). Isi token lewat halaman /sinkronisasi, atau build dengan ERAPOR_PACKAGE_CLOUD_TOKEN=1
  bila installer memang hanya untuk dipakai sendiri.
