# Rencana: Portal Orang Tua & Murid

Status: **rencana (belum diimplementasikan)**. Dokumen ini jadi acuan kerja rilis pertama.

## 1. Ringkasan

Menambah jalur akses baca-saja untuk **orang tua dan murid** agar bisa melihat sendiri:
absensi (rekap bulanan & semester), absensi harian/detail per mapel, nilai per mapel,
rapor versi web, dan unduh rapor PDF — tanpa harus meminta wali kelas.

Portal ini **tidak menambah fitur tulis**. Semua data yang ditampilkan sudah ada di DB dan
sudah dipakai halaman guru; pekerjaan utamanya adalah otorisasi sempit (satu murid), penyajian
ulang, dan pembatasan rute.

## 2. Keputusan yang sudah dikunci

| Topik             | Keputusan                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Sumber akun       | Dibuat admin/wali kelas dari halaman pengguna, **bukan** self-service                                     |
| Username          | **NIS** murid                                                                                             |
| Pemegang akun     | **Satu akun per murid**, dipakai orang tua maupun murid                                                   |
| Kata sandi awal   | Di-generate sistem, wajib diganti saat login pertama                                                      |
| Isi rilis 1       | Absensi rekap (bulanan + semester), absensi harian per mapel, nilai per mapel, rapor web, unduh rapor PDF |
| Periode           | Semester aktif saja. Arsip semester lampau = fase berikutnya                                              |
| Jawaban orang tua | Rilis 1 hanya lihat; kolom "tanggapan orang tua" di rapor tetap dikosongkan                               |

## 3. Model akun & otorisasi

### 3.1 Skema

`auth_user` (`src/lib/server/db/schema.ts:21`) sudah punya `sekolahId`, `pegawaiId`, `kelasId`,
`mataPelajaranId`, `mustChangePassword`, dan `type`. Yang perlu ditambah:

1. **Kolom `murid_id`** → `int().references(() => tableMurid.id)`. Ini kunci tunggal yang
   menentukan "akun ini milik murid siapa". Semua query portal berangkat dari kolom ini.
2. **Nilai baru pada enum `type`**: `'orang_tua'` (schema.ts:35). Satu tipe untuk dua pemakai
   (ortu + murid) karena akunnya memang satu; tidak perlu dua tipe.
3. **Grup izin baru** `portal` di `groupedUserPermissions` (`src/routes/pengguna/permissions.ts:1`)
   dengan satu nilai: `['lihat', 'Lihat portal']` → permission `portal_lihat`.
   Tambahkan ke `defaultPermissionsByType.orang_tua` (permissions.ts:86) saja — **jangan**
   masukkan ke set `user`/`wali_kelas` supaya guru tidak otomatis melihat menu portal.
4. **Entri menu-route** di `menuRoutePermissions` (permissions.ts:156):
   `{ path: '/portal', permission: 'portal_lihat' }` → hooks otomatis memblokir `/portal/**`
   untuk yang tidak berhak (hooks.server.ts:292-303), dan `menu.svelte` otomatis menyembunyikan
   menunya (menu.svelte:64-71).
5. **Item drawer** di `src/lib/components/menu.ts:1` (satu item `Portal` → `/portal`).
6. Karena fork ini fresh (tanpa migration/back-compat), perubahan skema cukup lewat
   `pnpm db:push` + helper `ensure-*` baru bila perlu.

### 3.2 Guard di hooks

Titik sentuh di `src/hooks.server.ts`:

| Baris                                   | Perlu apa                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:142` authGuard                        | `locals.user.muridId` ikut di-expose (baris 163-175)                                                                                                                                                                        |
| `:217-238` guard `?kelas_id=`           | Untuk `orang_tua`: **tolak** `?kelas_id=` maupun `?murid_id=`, bukan cek pemilikan kelas                                                                                                                                    |
| `:248-266` gerbang `mustChangePassword` | Allowlist saat ini hanya `/pengaturan`, `/sekolah/form*`, `/logout`, `/api/storage/browse`, `/api/database/import`. Orang tua tidak berurusan dengan halaman itu → tambahkan `/portal/ubah-sandi` (dan API yang dipakainya) |
| `:319-328` pin sekolah                  | Tiru pola `kepala_sekolah`: paksa cookie `active-sekolah-id` = `user.sekolahId` untuk `orang_tua`                                                                                                                           |
| `:308-373` cookieParser                 | Tetap jalan; `locals.sekolah` dipakai payload rapor (`preview-data.ts:99`)                                                                                                                                                  |

### 3.3 Layout

`src/routes/+layout.server.ts` bercabang per tipe (`:104` wali_kelas, `:141` wali_asuh,
`:172` user, `:329` kepala_sekolah) untuk menentukan kelas/konteks aktif. Perlu cabang baru:
untuk `orang_tua`, kelas aktif **selalu** kelas murid (`murid.kelasId`), tidak mengikuti
`active-kelas-id` cookie. Ini yang mencegah orang tua kelas A melihat kelas B walau cookie-nya
diketik manual.

### 3.4 Halaman awal

`src/routes/+page.server.ts` (dashboard guru) harus me-redirect `type === 'orang_tua'` ke
`/portal`, supaya login tidak mendarat di dashboard kosong.

## 4. Rute & halaman baru

Route group baru: `src/routes/(portal)/portal/**`. Semua loader-nya memanggil satu helper
`resolvePortalMurid(locals)` yang:

- menolak bila `locals.user.type !== 'orang_tua'`;
- mengambil `muridId` **dari sesi**, bukan dari URL/query/body;
- memuat murid + kelas + semester aktif, dan memastikan `murid.sekolahId === locals.sekolah.id`.

| Rute                 | Isi                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `/portal`            | Ringkasan: identitas murid, kelas, semester aktif, kartu ringkas kehadiran, tautan cepat |
| `/portal/absensi`    | Tab rekap (bulan + semester) dan tab detail harian per mapel                             |
| `/portal/nilai`      | Daftar nilai per mapel + deskripsi capaian (tanpa angka mentah asesmen)                  |
| `/portal/rapor`      | Rapor versi web, memakai payload rapor yang sama dengan halaman cetak                    |
| `/portal/rapor.pdf`  | Endpoint yang membuat token PDF lalu mengalihkan ke generator PDF                        |
| `/portal/ubah-sandi` | Form ganti sandi minimal (satu field lama + dua field baru)                              |

Di luar portal, `orang_tua` **tidak** mendapat akses ke `/murid`, `/nilai-akhir`, `/cetak`,
`/presensi-murid`, dsb., karena izinnya hanya `portal_lihat`.

## 5. Sumber data (yang dipakai ulang)

### 5.1 Nilai & rapor — bisa dipakai apa adanya

`getRaporPreviewPayload` (`src/routes/cetak/rapor/preview-data.ts:98`) merakit seluruh isi rapor:
nilai intrakurikuler + deskripsi capaian, kokurikuler, ekstrakurikuler, kehadiran rapor
(`computeRaporAttendance`, dipakai di `:532`), catatan wali kelas, keputusan naik. Ia membaca
`murid_id` dan `kelas_id` dari URL (`:104-105`) dan menyaring per `sekolahId` (`:107-112`).

Konsekuensi untuk portal: **jangan** teruskan URL dari pengguna. Bangun `URL` baru di server
dengan `murid_id` dari sesi, lalu panggil fungsi yang sama. Dengan begitu logika rapor hanya
ada di satu tempat.

### 5.2 Absensi — perlu loader versi per-murid

Empat loader absensi yang ada semuanya **ber-scope kelas**, bukan murid, dan berbentuk grid
dengan pencarian + paginasi:

- `loadPersentaseBulanan` (`src/lib/server/absen/load-persentase-bulanan.ts:17`)
- `loadPersentaseSemester` (`src/lib/server/absen/load-persentase-semester.ts:18`)
- `loadHarian` (`src/lib/server/absen/load-harian.ts:467`)
- `loadRapor` (`src/lib/server/absen/load-rapor.ts:19`)
- `computeNilaiAkhirRekap` (`src/lib/server/nilai-akhir.ts:148`) juga `{ sekolahId, kelasId }`

Semuanya menerima `presensiSettings` dan menerapkan **empat blok logika presensi** yang
digelar di `AGENTS.md` (wali kelas masuk-saja / masuk-pulang / tiap mapel awal mapel / tiap
mapel awal-akhir), termasuk aturan `totalPertemuan *= 2` dan penggandaan sakit/izin/alfa.

Rencana: buat pembungkus tipis `src/lib/server/portal/absensi.ts` yang memanggil loader kelas
dengan `kelasId` = kelas murid, lalu mengambil baris milik murid tersebut. **Jangan menyalin
ulang logika empat blok itu** — risiko terbesar dokumen ini adalah percabangan yang menyimpang
dari perhitungan guru, sehingga rapor dan portal memberi angka kehadiran berbeda. Bila
mengambil satu baris dari grid terasa janggal (paginasi, pencarian), alternatifnya adalah
mengekstrak inti perhitungan ke fungsi yang menerima `muridIds`, bukan menulis rumus baru.

Detail harian per mapel dibaca dari `ketidakhadiran_harian` (schema.ts:1089) dan `absensi`
(schema.ts:1068), dengan status: Hadir / Sakit / Izin / Alfa, kosong = belum diisi (TK).

### 5.3 Periode

Rilis 1 menampilkan semester aktif, diambil lewat `resolveSekolahAcademicContext(sekolahId)`
(`src/lib/server/db/academic.ts`). Murid lama (kelas/semester berbeda) belum ditangani.

## 6. Unduh rapor PDF

Alur yang ada:

1. `storePdfParams` (`src/lib/server/pdf/token-store.ts:30`) menyimpan parameter di memori →
   token (single-use, TTL).
2. `GET /cetak/pdf/[slug]/[token]` (`src/routes/cetak/pdf/[slug]/[token]/+server.ts:12`)
   menukar token, menyusun ulang payload, lalu `generatePDF` → PDF.

Catatan penting: endpoint token itu **tidak memeriksa otorisasi ulang** — token adalah
kapabilitasnya. Karena itu:

- `/portal/rapor.pdf` **hanya** menyimpan parameter dari sesi (`murid_id` milik sendiri),
  tidak pernah dari query pengguna;
- jangan membuka halaman `/cetak/rapor` (`src/routes/cetak/rapor/+page.server.ts:13`, gerbang
  `getKelasContextForUser` di `src/lib/server/route-utils.ts:44`) untuk `orang_tua` — pakai
  jalur portal;
- token store ada di memori proses, jadi portal PDF tidak cocok kalau nanti aplikasi berjalan
  multi-proses; catat sebagai keterbatasan.

## 7. Pembuatan akun & distribusi

Halaman baru: `/pengguna/akun-portal` (izin `user_add`):

- pilih kelas → daftar murid + status "belum punya akun / sudah";
- tombol buat akun satu murid dan "buat untuk semua murid di kelas ini";
- buat akun: `username = murid.nis`, sandi acak, `mustChangePassword = true`, type `orang_tua`,
  `muridId`, `sekolahId`, `permissions = defaultPermissionsByType.orang_tua`;
- tampilkan hasil (username + sandi awal) sekali saja, dengan tombol cetak daftar kredensial
  untuk dibagikan ke murid — ini alasan sandi tidak boleh disimpan dalam bentuk terbaca.

Helper yang dipakai ulang: `hashPassword` (`src/lib/server/auth.ts`), `resolveUniqueUsername`
(`src/lib/server/usernames.ts` — penting karena `usernameNormalized` unik **global**, jadi NIS
yang sama di dua sekolah harus dapat sufiks), `defaultPermissionsByType`
(`src/routes/pengguna/permissions.ts:86`), `authority('informasi_umum_murid')`
(`src/routes/pengguna/utils.server.ts`).

Karena `mustChangePassword` memaksa ganti sandi sebelum akses lain (hooks.server.ts:248),
sandi acak itu otomatis sekali pakai. Pastikan gerbangnya mengarah ke `/portal/ubah-sandi` dan
bukan `/pengaturan` yang penuh menu guru.

## 8. Daftar periksa keamanan (wajib diuji, bukan diasumsikan)

1. Orang tua murid A tak bisa membuka data murid B lewat `?murid_id=` di rute portal.
2. `?kelas_id=` tidak berpengaruh pada portal (ditolak atau diabaikan).
3. Cookie `active-sekolah-id` yang diubah manual tidak membawa orang tua ke sekolah lain.
4. Token PDF murid A tidak bisa dipakai untuk murid B, dan token tetap single-use + kedaluwarsa.
5. `orang_tua` tak bisa menulis apa pun (tanpa aksi form selain ubah sandi).
6. Rute guru (`/murid`, `/nilai-akhir`, `/cetak`, `/presensi-murid`) menolak `orang_tua`.
7. Akun tanpa `murid_id` tidak boleh masuk portal (gagal tertutup, bukan menampilkan apa pun).
8. Riwayat login/ganti sandi memakai mekanisme sesi yang sudah ada (tanpa sesi paralel).

## 9. Rencana kerja bertahap

Tiap fase harus lolos `pnpm check` (0 error/0 warning) dan `prettier --check` sebelum lanjut.
`pnpm lint` tidak bisa jadi gerbang: sudah ada 144 error lama di ~87 berkas lain.

| Fase | Isi                                                                                                                                    | Bukti                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F1   | Skema + izin: kolom `murid_id`, tipe `orang_tua`, grup izin `portal`, entri menu-route, item drawer                                    | `pnpm check` bersih, `pnpm db:push` jalan, izin tampil di form pengguna                  |
| F2   | Gerbang akses: cabang `orang_tua` di layout, pin sekolah, larangan `?kelas_id=`/`?murid_id=`, redirect dashboard, allowlist ubah sandi | Uji manual: login ortu → mendarat di `/portal`; rute guru menolak; ubah sandi jalan      |
| F3   | Pembuatan akun `/pengguna/akun-portal` + halaman cetak kredensial                                                                      | Buat akun 1 murid + massal, login pakai hasilnya, `mustChangePassword` terpicu           |
| F4   | Isi portal: absensi (rekap + harian), nilai, rapor web                                                                                 | Bandingkan angka portal vs halaman guru untuk murid & semester yang sama — harus identik |
| F5   | Unduh rapor PDF + pengetatan                                                                                                           | PDF terbuka; token bekas/kedaluwarsa gagal; uji lintas murid & lintas sekolah            |

Sisa yang belum diputuskan ditulis di bagian 10 supaya tidak menyusup sebagai asumsi di tengah
implementasi.

## 10. Keputusan terbuka

1. **Nama tipe akun**: dokumen ini memakai `orang_tua`. Kalau sekolah lebih suka `wali_murid`,
   ganti sebelum F1 (nama ikut ke enum DB, jadi mahal untuk diubah setelah dirilis).
2. **Satu akun vs dua akun**: keputusan sekarang satu akun per murid. Bila kepala sekolah ingin
   ortu dan murid bisa login bersamaan dari perangkat berbeda, perlu tabel relasi akun→murid.
3. **Arsip semester**: rilis 1 hanya semester aktif. Kalau orang tua perlu membuka rapor semester
   lama, butuh pemilih semester + aturan hak akses per tahun ajaran.
4. **Catatan/tanggapan orang tua**: kolom `tanggapanOrangTua` di payload rapor
   (`preview-data.ts:580`) masih string kosong. Bila nanti mau diisi ortu, itu fitur tulis dan
   perlu alur moderasi wali kelas.
5. **Notifikasi**: tidak ada rencana kirim surel/WhatsApp kredensial pada rilis 1 — dibagikan
   cetak/manual.

## 11. Referensi kode

| Kebutuhan                      | Lokasi                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Tabel pengguna & tipe akun     | `src/lib/server/db/schema.ts:21`, enum di `:35`                                             |
| Tabel murid / wali / catatan   | `schema.ts:352`, `:343`, `:395`                                                             |
| Absensi & ketidakhadiran       | `schema.ts:1068`, `:1089`, `:1121`                                                          |
| Nilai: sumatif / formatif / TP | `schema.ts:564`, `:616`, `:592`                                                             |
| Pengaturan presensi            | `schema.ts:930`                                                                             |
| Guard & sesi                   | `src/hooks.server.ts:142`, `:217`, `:248`, `:292`, `:308`                                   |
| Izin & menu-route              | `src/routes/pengguna/permissions.ts:86`, `:137`, `:156`, `:188`                             |
| Drawer                         | `src/lib/components/menu.ts:1`, `menu.svelte:64`                                            |
| Konteks kelas per tipe         | `src/lib/server/route-utils.ts:44`, `src/routes/+layout.server.ts:104`                      |
| Loader absensi (kelas)         | `src/lib/server/absen/load-{harian,persentase-bulanan,persentase-semester,rapor}.ts`        |
| Rekap nilai (kelas)            | `src/lib/server/nilai-akhir.ts:148`                                                         |
| Payload rapor                  | `src/routes/cetak/rapor/preview-data.ts:98`                                                 |
| Kehadiran rapor                | `src/lib/server/pdf/attendance-utils.ts`                                                    |
| Token PDF                      | `src/lib/server/pdf/token-store.ts:30`, `src/routes/cetak/pdf/[slug]/[token]/+server.ts:12` |
| Helper akun                    | `src/lib/server/auth.ts`, `src/lib/server/usernames.ts`                                     |
| Konteks semester aktif         | `src/lib/server/db/academic.ts`                                                             |
