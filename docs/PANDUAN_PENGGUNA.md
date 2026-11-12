# Panduan Pengguna Lengkap e-Rapor SMK Pratama Mulya
*Sistem Administrasi Guru Terpadu & Penilaian Kurikulum Merdeka*

Dokumen ini memuat panduan operasional lengkap untuk seluruh modul pada aplikasi e-Rapor SMK Pratama Mulya. Panduan disusun terstruktur berdasarkan alur kerja nyata di sekolah, mulai dari persiapan awal semester, proses penilaian harian dan sumatif, administrasi guru, hingga pencetakan rapor akhir dan pengelolaan data master oleh operator.

---

## Daftar Isi

1. [Peran Pengguna dan Alur Kerja Utama](#1-peran-pengguna-dan-alur-kerja-utama)
2. [Modul Persiapan Penilaian](#2-modul-persiapan-penilaian)
3. [Modul Penilaian (Formatif, Sumatif Matriks Excel, Nilai Akhir)](#3-modul-penilaian)
4. [Modul Administrasi Guru dan Wali Kelas](#4-modul-administrasi-guru-dan-wali-kelas)
5. [Modul Khusus SMK dan Karakter (PKL, P5, Ekstrakurikuler)](#5-modul-khusus-smk-dan-karakter)
6. [Modul Cetak Dokumen dan Kustomisasi Rapor](#6-modul-cetak-dokumen-dan-kustomisasi-rapor)
7. [Modul Operator dan Master Data](#7-modul-operator-dan-master-data)
8. [Pintasan Keyboard dan Pemecahan Masalah](#8-pintasan-keyboard-dan-pemecahan-masalah)

---

## 1. Peran Pengguna dan Alur Kerja Utama

Aplikasi membagi hak akses ke dalam empat peran utama:

| Peran | Tanggung Jawab Utama | Menu yang Diakses |
|---|---|---|
| **Operator / Admin** | Konfigurasi sekolah, tahun ajaran, semester, kelas, data murid, pemetaan guru mapel, bobot nilai, akun pengguna, dan kunci nilai. | Master Data, Informasi Umum, Cetak, Kunci Nilai, Pengaturan Sistem. |
| **Guru Mata Pelajaran** | Menyusun TP, memilih teknik penilaian, mengisi asesmen formatif, mengisi asesmen sumatif harian/STS/SAS, mengisi jurnal mengajar, dan presensi guru. | Modul Guru: Persiapan Penilaian, Penilaian, Administrasi Guru, Fitur Tambahan. |
| **Wali Kelas** | Memantau rekap nilai kelas, mengelola absensi semester murid, mengisi catatan wali kelas, memvalidasi PKL, dan menetapkan keputusan kenaikan/kelulusan. | Modul Wali Kelas: Manajemen Kelas, Monitor Penilaian, Rapor, Fitur Tambahan. |
| **Kepala Sekolah** | Memantau seluruh aktivitas penilaian, menyetujui cetak rapor, menandatangani dokumen secara digital, dan melihat audit sistem. | Akses monitoring menyeluruh, kustomisasi cetak, dan tanda tangan digital. |

### Alur Kerja Semesteran

1. **Awal Semester (Operator & Guru)**:
   - Operator memastikan Tahun Ajaran, Semester aktif, rombel kelas, data murid, dan penugasan guru pengampu sudah benar.
   - Guru Mapel masuk ke menu **Persiapan Penilaian** untuk menetapkan Tujuan Pembelajaran (TP) dan teknik penilaian yang akan digunakan.
2. **Sepanjang Semester (Guru & Wali Kelas)**:
   - Guru mengisi catatan ketuntasan pada **Penilaian Formatif** selama proses belajar.
   - Guru mengisi nilai per TP (ulangan harian, tugas, praktik, proyek) pada tabel matriks **Penilaian Sumatif**.
   - Guru mengisi **Jurnal Mengajar** dan **Presensi Guru** setiap kali tatap muka.
   - Wali kelas memantau kehadiran siswa di menu **Presensi Murid**.
3. **Tengah Semester (Guru & Wali Kelas)**:
   - Guru mengisi nilai STS (Sumatif Tengah Semester) pada tabel matriks sumatif.
   - Wali kelas mencetak **Rapor Tengah Semester (RTS)** dan mengisi catatan tengah semester.
4. **Akhir Semester (Guru, Wali Kelas, Kepala Sekolah)**:
   - Guru menyelesaikan nilai SAS (Sumatif Akhir Semester), memeriksa Nilai Akhir & Deskripsi Capaian Kompetensi yang digenerasi otomatis oleh sistem.
   - Operator mengaktifkan **Kunci Nilai** setelah batas waktu pengisian berakhir.
   - Wali kelas mengisi **Catatan Akhir Semester**, mengecek nilai ekskul, dan menetapkan keputusan kenaikan kelas (semester genap).
   - Wali kelas dan Kepala Sekolah membubuhkan tanda tangan digital lalu mencetak Rapor Lengkap (Cover, Biodata, Nilai Akhir, Rapor P5, Rapor PKL).

---

## 2. Modul Persiapan Penilaian

Modul ini diakses oleh Guru Mata Pelajaran sebelum memulai penginputan nilai.

### 2.1 Capaian Kompetensi & Tujuan Pembelajaran (TP)
*Menu: Persiapan Penilaian > Capaian Kompetensi & TP (`/intrakurikuler`)*

Halaman ini berfungsi mendaftarkan kompetensi dan materi yang diajarkan pada semester berjalan:

1. Pilih **Kelas** dan **Mata Pelajaran** yang Anda ampu.
2. Tentukan **Lingkup Materi** (Bab / Pokok Bahasan), misalnya *Berpikir Komputasional*, *Jaringan Komputer dan Internet*, atau *Algoritma Pemrograman*.
3. Klik tombol **Tambah Tujuan Pembelajaran (TP)**.
4. Masukkan deskripsi TP dengan bahasa operasional yang jelas, misalnya:
   - *"Menerapkan strategi berpikir komputasional untuk memecahkan persoalan komputasi."*
   - *"Menyusun algoritma dan flowchart terstruktur dalam menyelesaikan masalah."*
5. Atur **Bobot TP** (default dibagi rata otomatis, misalnya 4 TP masing-masing berbobot 25%).
6. TP yang Anda daftarkan di sini akan otomatis menjadi kolom penilaian pada tabel Penilaian Sumatif dan dasar kalimat deskripsi rapor.

### 2.2 Teknik Penilaian
*Menu: Persiapan Penilaian > Teknik Penilaian (`/teknik-penilaian`)*

Kurikulum Merdeka mengelompokkan penilaian berdasarkan instrumen yang tepat:

- **Tes Tertulis (UH / Ulangan Harian)**: Ujian pilihan ganda atau esai terjadwal.
- **Penugasan (Tugas)**: Lembar kerja siswa, pekerjaan rumah, atau kajian mandiri.
- **Kinerja / Praktik**: Uji keterampilan langsung di laboratorium, bengkel, atau lapangan.
- **Proyek**: Tugas terstruktur kelompok dalam periode waktu tertentu.
- **Portofolio**: Kumpulan karya dan dokumentasi progres belajar siswa.
- **Produk**: Benda kerja fisik atau karya digital (aplikasi, desain grafis, video).
- **Tes Lisan**: Tanya jawab interaktif langsung saat pembelajaran.

Setiap TP dapat dipasangkan dengan teknik penilaian yang relevan sehingga guru dan siswa mengetahui metode pengukuran capaian tersebut.

---

## 3. Modul Penilaian

Modul ini merupakan inti proses input nilai bagi Guru Mata Pelajaran.

### 3.1 Penilaian Formatif
*Menu: Penilaian > Penilaian Formatif (`/asesmen-formatif`)*

Penilaian formatif bertujuan memantau proses belajar dan memberikan umpan balik berkala:

1. Pilih kelas dan mata pelajaran.
2. Pilih Tujuan Pembelajaran (TP) yang sedang dinilai.
3. Berikan tanda centang **Tercapai** atau **Perlu Bimbingan** untuk setiap siswa.
4. Nilai formatif **tidak dihitung ke dalam angka rapor akhir**, melainkan berfungsi sebagai rekam jejak diagnostik guru untuk membantu siswa yang belum tuntas.

### 3.2 Penilaian Sumatif (Tabel Matriks Spreadsheet Excel)
*Menu: Penilaian > Penilaian Sumatif (`/asesmen-sumatif`)*

Halaman ini dirancang menggunakan antarmuka **Spreadsheet Matriks**, sehingga guru dapat mengisi nilai seluruh siswa dalam satu kelas sekaligus tanpa berpindah-pindah halaman.

#### Struktur Tabel Matriks

- **Kolom Kiri**: Nomor Urut, NIS/NISN, dan Nama Siswa.
- **Kolom Tengah (Nilai Harian per TP)**: Kolom dinamis berdasarkan jumlah TP yang Anda buat di modul persiapan (TP 1, TP 2, TP 3, dst.), lengkap dengan badge teknik penilaian (UH, Tugas, Praktik, dsb.).
- **Kolom Rata TP (NA Lingkup)**: Rata-rata otomatis nilai harian seluruh TP siswa.
- **Kolom STS**: Nilai Sumatif Tengah Semester (Tes & Non-Tes).
- **Kolom SAS**: Nilai Sumatif Akhir Semester (Tes & Non-Tes).
- **Kolom Nilai Akhir (NA)**: Nilai akhir rapor siswa yang dihitung otomatis secara live sesuai bobot penilaian sekolah.

#### Cara Pengisian Cepat dengan Keyboard

Bekerja di tabel ini sama praktisnya seperti menggunakan Microsoft Excel:

- **Navigasi Panah & Enter**: Tekan tombol `Enter` atau `Panah Bawah` ($\downarrow$) untuk turun ke siswa berikutnya pada kolom yang sama. Tekan `Panah Atas` ($\uparrow$) untuk naik.
- **Pindah Kolom**: Tekan `Tab` untuk bergeser ke kolom TP berikutnya ke kanan. Tekan `Shift + Tab` untuk bergeser ke kiri.
- **Otomatis Blok Angka**: Saat berpindah kotak input, angka lama langsung terblok otomatis. Anda cukup mengetik angka baru tanpa perlu menekan tombol hapus (Backspace).
- **Simpan Cepat (Shortcut Keyboard)**: Tekan tombol `Ctrl + S` (atau `Cmd + S` di Mac) kapan saja untuk langsung menyimpan seluruh isi tabel ke server tanpa menggeser mouse.
- **Pengisian Cepat Satu Kolom (Fitur Petir ⚡)**:
  - Klik ikon petir di header kolom TP yang ingin diisi serentak.
  - Masukkan angka nilai standar, lalu simpan.
  - Seluruh siswa pada kolom tersebut akan terisi dengan angka tersebut, lalu Anda tinggal mengedit siswa yang nilainya berbeda.

> [!TIP]
> Kotak input yang baru saja Anda ubah dan belum tersimpan ditandai dengan warna aksen khusus. Setelah Anda menekan tombol **Simpan Nilai Matriks** atau pintasan `Ctrl + S`, tanda tersebut berubah kembali normal dan muncul notifikasi sukses.

### 3.3 Nilai Akhir & Deskripsi Rapor
*Menu: Penilaian > Nilai Akhir & Deskripsi Rapor (`/nilai-akhir`)*

Setelah nilai sumatif selesai diinput, sistem secara otomatis mengolah capaian kompetensi menjadi narasi rapor:

1. Sistem membandingkan skor antar-TP untuk setiap siswa.
2. **Capaian Tertinggi**: TP dengan perolehan nilai paling tinggi otomatis diformulasikan menjadi kalimat:
   *"Menunjukkan penguasaan yang sangat baik dalam [deskripsi TP tertinggi]."*
3. **Capaian Terendah**: TP dengan nilai paling rendah otomatis diformulasikan menjadi kalimat:
   *"Perlu bimbingan dan peningkatan dalam [deskripsi TP terendah]."*
4. Guru dapat membaca draf deskripsi ini dan melakukan penyesuaian kata-kata manual pada kotak yang tersedia jika diperlukan penekanan khusus bagi siswa tertentu.
5. Klik **Simpan Deskripsi** untuk memfinalisasi data sebelum ditarik ke rapor cetak.

### 3.4 Impor & Ekspor Nilai Excel
*Menu: Penilaian > Impor (`/impor`)*

Bagi guru yang lebih nyaman mengolah nilai di aplikasi spreadsheet mandiri:

1. Pilih menu **Impor**, pilih filter kelas dan mata pelajaran.
2. Klik tombol **Unduh Format Excel** untuk mendapatkan template resmi yang sudah memuat nama siswa dan kode TP.
3. Isi nilai siswa pada file Excel tersebut secara offline. Jangan mengubah susunan baris dan ID siswa.
4. Unggah kembali file Excel melalui form unggah pada halaman yang sama.
5. Periksa pratinjau data yang terbaca, lalu klik **Konfirmasi Impor**.

---

## 4. Modul Administrasi Guru dan Wali Kelas

### 4.1 Presensi Murid
*Menu: Administrasi > Presensi Murid (`/presensi-murid`)*

Aplikasi mendukung empat skenario presensi sesuai kebijakan sekolah (diatur di menu Akademik):

1. **Wali Kelas Saja + Masuk Saja**: Wali kelas mencatat 1 sesi kehadiran per hari (Hadir, Sakit, Izin, Alfa).
2. **Wali Kelas Saja + Masuk & Pulang**: Pencatatan 2 sesi per hari (sesi pagi dan sesi pulang).
3. **Tiap Mapel + Awal Mapel**: Setiap guru mapel mencatat kehadiran di awal jam pelajarannya.
4. **Tiap Mapel + Awal & Akhir Mapel**: Guru mapel memverifikasi kehadiran siswa di awal dan akhir jam pelajaran (2 sesi per pertemuan).

Tersedia fitur **Isi Sekaligus** untuk menandai semua siswa hadir dalam satu klik, kemudian guru tinggal menandai siswa yang sakit, izin, atau tanpa keterangan.

### 4.2 Jurnal Mengajar Harian & RPM
*Menu: Administrasi > Jurnal Mengajar (`/jurnal-mengajar`) & RPM (`/rpm`)*

- **Jurnal Mengajar**: Tempat guru mencatat agenda setiap pertemuan pembelajaran (Hari/Tanggal, Jam Ke-, Materi Pembelajaran yang disampaikan, Hambatan di kelas, dan Solusi).
- **RPM (Rencana Pembelajaran Mendalam / Deep Learning)**: Memuat rancangan kegiatan belajar berbasis kurikulum merdeka yang terhubung langsung dengan TP dan materi pokok.

### 4.3 Presensi Guru & Tanda Tangan Paraf Digital
*Menu: Administrasi > Presensi Guru (`/presensi-guru`) & Tanda Tangan (`/tanda-tangan`)*

- **Presensi Guru**: Guru mengisi kehadiran kedatangan mengajar harian.
- **Tanda Tangan Digital**:
  - Guru, Wali Kelas, dan Kepala Sekolah dapat mengunggah tanda tangan atau paraf transparan pada menu **Tanda Tangan**.
  - Tanda tangan ini tersimpan aman di database dan otomatis tersemat pada dokumen cetak PDF (rapor, piagam, jurnal mengajar, dan surat keterangan) tanpa perlu tanda tangan basah manual satu per satu.

### 4.4 Catatan Wali Kelas & Keputusan Kenaikan
*Menu: Administrasi > Catatan Wali Kelas (`/catatan-wali-kelas`) & Keputusan (`/keputusan`)*

- **Catatan Wali Kelas**: Berisi motivasi dan evaluasi kepribadian murid. Dibagi menjadi dua bagian: **Catatan Tengah Semester** (tampil di rapor PTS) dan **Catatan Akhir Semester** (tampil di rapor semester utama).
- **Keputusan (Semester Genap)**: Wali kelas menetapkan status kenaikan kelas untuk tiap murid:
  - *Naik ke Kelas XI / XII*
  - *Tinggal di Kelas X / XI*
  - *Lulus dari Satuan Pendidikan* (khusus kelas XII akhir)

---

## 5. Modul Khusus SMK dan Karakter

### 5.1 Prakerin / PKL SMK
*Menu: Input Nilai > PKL (Prakerin) (`/prakerin`)*

Sebagai sekolah kejuruan, e-Rapor SMK Pratama Mulya menyediakan modul khusus Praktik Kerja Lapangan:

1. **Pendataan Mitra DU/DI**: Masukkan nama dunia usaha/dunia industri tempat siswa magang, alamat, kontak penanggung jawab, serta lama pelaksanaan (misalnya 3 bulan atau 6 bulan).
2. **Penetapan Guru Pembimbing**: Tentukan guru pembimbing sekolah yang memonitor kelompok PKL.
3. **Penilaian Aspek Teknis & Non-Teknis**: Nilai keterampilan kerja di industri, kedisiplinan, keselamatan kerja (K3), etos kerja, dan catatan pembimbing industri.
4. **Cetak Sertifikat / Rapor PKL**: Sistem menerbitkan lembar Rapor PKL tersendiri yang siap dibagikan kepada siswa setelah program magang selesai.

### 5.2 Kokurikuler / Projek Penguatan Profil Pelajar Pancasila (P5)
*Menu: Input Nilai > P5 (Projek Pancasila) (`/p5`)*

Modul ini mengelola asesmen projek kokurikuler sesuai standar Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP):

1. **Pemilihan Tema & Projek**: Pilih tema nasional (misalnya *Kewirausahaan*, *Kebekerjaan*, *Gaya Hidup Berkelanjutan*, atau *Bangunlah Jiwa dan Raganya*).
2. **Pemetaan Dimensi & Subelemen**: Pilih elemen profil pelajar Pancasila yang ditargetkan pada tema tersebut (misalnya Mandiri, Gotong Royong, Bernalar Kritis, Kreatif).
3. **Input Penilaian Rubrik**: Berikan capaian per subelemen untuk setiap siswa:
   - **MB** (Mulai Berkembang)
   - **SB** (Sedang Berkembang)
   - **BSH** (Berkembang Sesuai Harapan)
   - **SAB** (Sangat Berkembang)
4. **Catatan Proses**: Masukkan catatan apresiasi proses projek murid untuk dicetak pada Lembar Rapor P5 tersendiri.

### 5.3 Nilai Ekstrakurikuler
*Menu: Input Nilai > Ekstrakurikuler (`/nilai-ekstrakurikuler`)*

1. Memilih nama kegiatan ekstrakurikuler (Pramuka, PMR, Futsal, Rohis, Musik, dsb.).
2. Tersedia dukungan untuk **Ekstrakurikuler Umum** yang diikuti siswa lintas rombel kelas.
3. Pembina atau wali kelas memberikan **Predikat** (Sangat Baik / Baik / Cukup) serta **Keterangan Kegiatan**, misalnya *"Aktif memimpin regu dan menunjukkan kedisiplinan tinggi dalam latihan mingguan."*

### 5.4 Poin Pelanggaran & Buku Tamu
*Menu: Fitur Tambahan > Poin Siswa (`/poin-siswa`) & Buku Tamu (`/buku-tamu`)*

- **Poin Siswa**: Sistem pencatatan poin pelanggaran tata tertib dan poin apresiasi prestasi siswa.
- **Buku Tamu**: Dokumentasi tamu kedinasan atau wali murid yang berkunjung ke sekolah dengan dukungan foto atau tanda tangan langsung di layar sentuh.

---

## 6. Modul Cetak Dokumen dan Kustomisasi Rapor

### 6.1 Cetak Dokumen Rapor
*Menu: Cetak > Cetak Dokumen (`/cetak`)*

Halaman cetak menggunakan teknologi **PagedJS** dengan mesin Chromium untuk menghasilkan dokumen PDF berkualitas cetak presisi:

- **Pilihan Dokumen**:
  - *Cover Rapor* (Halaman Sampul Utama)
  - *Biodata Peserta Didik*
  - *Rapor Tengah Semester (RTS)*
  - *Rapor Akhir Semester*
  - *Rapor Projek P5*
  - *Rapor PKL / Prakerin*
  - *Piagam Penghargaan Bintang Prestasi*
  - *Buku Induk Siswa*
  - *Leger Nilai Lengkap (Format Cetak & Rekap Excel)*
- **Mode Cetak**:
  - *Cetak Per Siswa*: Untuk melihat dan mencetak dokumen satu anak tertentu.
  - *Cetak Per Kelas (Massal)*: Menggabungkan seluruh siswa dalam satu file PDF kontinu siap cetak di printer sekolah.
- **Ukuran Kertas**: Mendukung kertas standar **A4** (210 × 297 mm) dan kertas folio **F4** (215 × 330 mm).

### 6.2 Kustomisasi Rapor (Live Preview)
*Menu: Cetak > Kustomisasi (`/cetak/kustomisasi`)*

Khusus untuk peran Administrator dan Kepala Sekolah, tampilan dokumen cetak dapat dikustomisasi secara fleksibel:

- **Pengaturan Kop & Identitas**: Atur teks nama dinas, nama sekolah, nomor izin operasional, alamat lengkap, kontak, serta unggah logo resmi (logo pemda di kiri, logo sekolah di kanan).
- **Watermark & Latar**: Aktifkan atau nonaktifkan logo transparan (watermark) di latar tengah halaman rapor beserta pengaturan tingkat opasitasnya.
- **Font & Tipografi**: Pilihan font resmi (Times New Roman, Arial, Calibri, dsb.) serta ukuran teks judul dan tabel.
- **Margin & Spasi**: Atur jarak tepi kertas (atas, bawah, kiri, kanan) serta padding sel tabel agar rapor tercetak rapi tanpa ada baris tabel yang terpotong canggung di akhir halaman.
- **Pratinjau Langsung (Live Preview)**: Panel kanan menampilkan tampilan nyata dokumen secara real-time setiap kali Anda mengubah pengaturan tanpa perlu mengunduh file PDF berulang kali.

---

## 7. Modul Operator dan Master Data

Modul ini dikelola secara terpusat oleh Operator Sekolah / Tim Admin:

1. **Profil Sekolah (`/master-data/sekolah`)**: Identitas pokok sekolah, NPSN, akreditasi, alamat, dan pejabat kepala sekolah.
2. **Tahun Ajaran & Semester (`/master-data/tahun_ajaran` & `/master-data/semester`)**: Menentukan semester yang sedang aktif berjalan. Semua transaksi nilai terikat pada semester aktif.
3. **Manajemen Rombel Kelas (`/master-data/kelas`)**: Menambah kelas, menentukan tingkatan (X, XI, XII), serta menetapkan wali kelas yang bertugas.
4. **Data Murid & Mutasi (`/master-data/murid`)**: Mengelola data induk siswa, nomor induk, NISN, status keaktifan (aktif, lulus, keluar, mutasi), serta arsip digital ijazah dan kartu keluarga.
5. **Mata Pelajaran & Pengampu (`/master-data/mata_pelajaran` & `/master-data/pengampu`)**: Mendaftarkan mata pelajaran kelompok umum, kejuruan, dan mulok, lalu memetakan guru pengampu untuk tiap-tiap kelas.
6. **Bobot Penilaian (`/master-data/bobot`)**: Menentukan persentase formula hitung nilai akhir:
   - *Rapor Tengah Semester (RTS)* = Bobot Lingkup Materi : Bobot STS
   - *Rapor Akhir Semester (SAS)* = Bobot Lingkup Materi : Bobot STS : Bobot SAS (contoh: 50% Lingkup : 25% STS : 25% SAS)
7. **Data Pengguna & Hak Akses (`/master-data/pengguna`)**:
   - Menambah akun guru dan operator, mereset kata sandi, serta menentukan izin khusus per pengguna.
   - Fitur impor akun guru dari file Excel.
8. **Kunci Nilai (`/kunci-nilai`)**: Mengunci form penilaian mapel tertentu atau kelas tertentu agar data nilai tidak dapat diubah lagi setelah batas waktu penginputan berakhir menjelang pembagian rapor.

---

## 8. Pintasan Keyboard dan Pemecahan Masalah

### Pintasan Keyboard pada Tabel Matriks Nilai

| Tombol / Pintasan | Fungsi |
|---|---|
| `Enter` atau `Panah Bawah (↓)` | Pindah dan fokus ke siswa di bawahnya pada kolom yang sama |
| `Panah Atas (↑)` | Pindah dan fokus ke siswa di atasnya pada kolom yang sama |
| `Tab` | Pindah ke kolom TP berikutnya di sebelah kanan |
| `Shift + Tab` | Pindah ke kolom TP sebelumnya di sebelah kiri |
| `Ctrl + S` atau `Cmd + S` | Simpan seluruh data nilai tabel matriks ke server secara instan |
| `Escape` | Membatalkan fokus atau menutup modal pengisian serentak |

### Pertanyaan yang Sering Muncul (FAQ) & Solusi

**Q1: Mengapa tombol Simpan tidak bisa diklik atau muncul peringatan "Nilai Terkunci"?**
> *Solusi*: Operator sekolah telah mengaktifkan fitur Kunci Nilai untuk mata pelajaran atau kelas tersebut. Hubungi Operator Sekolah / Tim Kurikulum untuk meminta pembukaan kunci sementara jika ada nilai susulan yang sah.

**Q2: Mengapa kolom TP di Penilaian Sumatif belum muncul?**
> *Solusi*: Anda belum mendaftarkan Tujuan Pembelajaran pada menu **Persiapan Penilaian > Capaian Kompetensi & TP**. Daftarkan minimal satu TP dan pastikan bobotnya sudah diatur, maka kolom penilaian sumatif akan otomatis terbuka.

**Q3: Di mana letak nilai Ulangan Harian dan Tugas di Kurikulum Merdeka?**
> *Solusi*: Pada Kurikulum Merdeka, Ulangan Harian dan Tugas merupakan bagian integral dari **Sumatif Lingkup Materi per TP**. Anda memasukkannya pada kolom TP 1, TP 2, dsb. dengan memilih teknik penilaian yang sesuai (misalnya TP 1 teknik Tes Tertulis untuk UH, TP 2 teknik Penugasan untuk Tugas).

**Q4: Apakah nilai formatif mempengaruhi nilai rapor siswa?**
> *Solusi*: Tidak. Penilaian formatif hanya bersifat kualitatif/pemantauan ketuntasan belajar harian untuk umpan balik guru dan siswa. Nilai yang masuk ke perhitungan rapor adalah Penilaian Sumatif Lingkup Materi, STS, dan SAS.

**Q5: Mengapa tanda tangan saya tidak muncul saat rapor dicetak?**
> *Solusi*: Pastikan Anda sudah mengunggah berkas tanda tangan transparan (format PNG) pada menu **Administrasi > Tanda Tangan**. Selain itu, pastikan opsi cetak tanda tangan pada menu **Cetak > Kustomisasi** berada dalam posisi aktif.

---
*e-Rapor SMK Pratama Mulya © 2026 — Tim Pengembang Kurikulum Terpadu*
