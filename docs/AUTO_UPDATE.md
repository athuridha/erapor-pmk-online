# Auto Update e-Rapor SMK Pratama Mulya

Dokumen ini menjelaskan cara aplikasi memeriksa, mengunduh, dan memasang pembaruan
secara otomatis, serta cara menerbitkan rilis baru ke GitHub Releases.

## Ringkas

| Tahap                     | Otomatis?                               | Pelaku                      |
| ------------------------- | --------------------------------------- | --------------------------- |
| Memeriksa GitHub Releases | Ya (startup + interval)                 | Server (`update-auto.ts`)   |
| Mengunduh installer       | Ya (opsional, bisa dimatikan)           | Server                      |
| Memasang installer        | Ya (opsional, saat aplikasi menganggur) | `scripts/auto-update.mjs`   |
| Menerbitkan rilis         | Tidak                                   | Admin repo (`pnpm release`) |

Alur otomatis berjalan sepenuhnya di server, jadi tidak ada guru/kepala sekolah
yang perlu menekan tombol apa pun.

## 1. Memeriksa Versi Baru

Server menjalankan penjadwal (`startUpdateScheduler`, dipanggil dari
`src/hooks.server.ts`):

- pemeriksaan pertama ~30 detik setelah server start (setelah schema siap),
- pemeriksaan berikutnya tiap 5 menit _tick_, namun hanya melakukan запрос ke
  GitHub bila sudah lewat dari interval yang diatur (default **6 jam**),
- sumber data: `https://api.github.com/repos/athuridha/eraport/releases/latest`.

Hasil pemeriksaan disimpan di tabel `app_meta` (key `update.auto.state`) supaya
tetap ada setelah aplikasi dimulai ulang, dan ditampilkan di
**Pengaturan → Cek Pembaruan** serta lewat notifikasi di layar.

> Kuota GitHub: 60 permintaan/jam per IP tanpa token. Interval default 6 jam
> memakai <<1 permintaan/jam. Bila perlu sering, set `GITHUB_TOKEN` di `.env`.

## 2. Mengunduh Installer

Bila versi lebih baru ditemukan dan **Unduh otomatis** aktif, server mengunduh
aset rilis (file `.exe`) di latar belakang ke:

```
%LOCALAPPDATA%\erapor-pmk\updates\<versi>\<nama-berkas>.exe
```

Berkas ini bertahan lintas restart, jadi unduhan yang terputus tidak diulang
dari nol.

## 3. Memasang Otomatis

Pemasangan otomatis dijalankan hanya bila **semua** syarat ini terpenuhi:

1. Fitur auto update aktif dan versi lebih baru tersedia.
2. Installer sudah terunduh lengkap di disk.
3. Aplikasi berjalan di **Windows** (installer adalah `.exe` Inno Setup).
4. Aplikasi **menganggur** minimal sesuai pengaturan "Menit menganggur sebelum
   dipasang" (default 15 menit) — dihitung dari request terakhir yang masuk.
5. Waktu sekarang berada di dalam **jam pemasangan** (default 19:00–05:00).
   Jam mulai = jam selesai berarti boleh dipasang kapan saja.

Turutan yang dijalankan `scripts/auto-update.mjs`:

1. Menunggu port server benar-benar bebas (server dimatikan oleh server utama).
2. Menjalankan installer secara senyap: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-`.
3. Menjalankan ulang aplikasi lewat `start-erapor-pmk.mjs` (atau `build/index.js`
   di mode pengembangan).

Log proses tersimpan di
`%LOCALAPPDATA%\erapor-pmk-data\logs\auto-update.log` (log installer di
`installer-auto-update.log` pada folder yang sama).

### Pengaman data

Data sekolah (database, foto, dokumen) berada di
`%LOCALAPPDATA%\erapor-pmk-data\`, terpisah dari folder aplikasi
`%LOCALAPPDATA%\erapor-pmk\`. Jadi mengganti berkas aplikasi tidak menghapus
data. Installer juga menjalankan migrasi database secara otomatis setelah
pemasangan.

## 4. Pengaturan

Buka **Pengaturan → Cek Pembaruan**. Bagian "Pembaruan otomatis" (hanya admin
dan kepala sekolah yang bisa mengubah):

| Pengaturan                               | Default       | Arti                                                |
| ---------------------------------------- | ------------- | --------------------------------------------------- |
| Periksa pembaruan otomatis               | aktif         | Sakelar utama semua perilaku otomatis               |
| Unduh installer di latar belakang        | aktif         | Installer diunduh begitu versi baru ditemukan       |
| Pasang otomatis saat aplikasi menganggur | aktif         | Installer dijalankan otomatis saat syarat terpenuhi |
| Interval pemeriksaan                     | 6 jam         | Jarak antar permintaan ke GitHub                    |
| Menit menganggur sebelum dipasang        | 15 menit      | Berapa lama aplikasi harus kosong                   |
| Jam mulai / selesai pemasangan           | 19:00 / 05:00 | Jendela waktu pemasangan otomatis                   |

Tersimpan di `app_meta` (key `update.auto.settings`) dan berlaku untuk seluruh
akun di instalasi tersebut.

## 5. Menerbitkan Rilis Baru

Sumber pembaruan adalah GitHub Releases, jadi rilis harus diterbitkan lebih dulu:

```bash
# Lihat rencananya dulu (tidak ada yang dieksekusi)
pnpm release -- --version 0.1.1 --dry-run

# Terbitkan: bump versi, build installer, commit + tag + push, unggah ke Releases
pnpm release -- --version 0.1.1
```

Yang dilakukan skrip `scripts/release.mjs`:

1. Validasi versi semver + pastikan working tree bersih.
2. Tulis versi baru ke `package.json`, commit `release: v0.1.1`.
3. Jalankan `pnpm prod` → menghasilkan `dist/windows/ERaporPMKSetup.exe`.
4. Buat tag git `v0.1.1` lalu push branch + tag.
5. Buat GitHub Release dan unggah `ERaporPMKSetup.exe`.
   - Memakai `gh` CLI bila terpasang (`gh auth login` sudah cukup),
   - bila tidak, memakai API GitHub dengan `GITHUB_TOKEN`/`GH_TOKEN`.

Opsi lain: `--skip-build` (pakai installer yang sudah ada), `--notes-file <file>`
(catatan rilis manual), `--prerelease`, `--yes` (lewati konfirmasi).

> Rilis yang sudah terbit tidak bisa diubah versi-nya. Untuk memperbaiki,
> buat rilis baru dengan nomor versi berikutnya.

## 6. Berkas yang Terlibat

| Berkas                                               | Peran                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/server/update-auto.ts`                      | Mesin auto update: pengaturan, pemeriksaan, unduhan, pemicu pemasangan   |
| `src/lib/server/update-manager.ts`                   | Sepaket dengan GitHub Releases & proses unduhan (dipakai juga UI manual) |
| `src/lib/server/activity.ts`                         | Pelacak "aplikasi menganggur"                                            |
| `scripts/auto-update.mjs`                            | Helper: tunggu server stop → pasang senyap → jalankan ulang              |
| `scripts/release.mjs`                                | Publikasi rilis ke GitHub Releases                                       |
| `src/routes/api/updates/state/+server.ts`            | Status + pengaturan (GET)                                                |
| `src/routes/api/updates/auto/+server.ts`             | Simpan pengaturan (POST, admin/kepala sekolah)                           |
| `src/routes/api/updates/check/+server.ts`            | Pemeriksaan paksa (POST)                                                 |
| `src/lib/components/settings/update-modal.svelte`    | UI "Cek Pembaruan" + pengaturan auto update                              |
| `src/lib/components/settings/update-notifier.svelte` | Notifikasi versi baru di layar                                           |

## 7. Troubleshooting

**Tidak ada notifikasi versi baru.**
Cek `Pengaturan → Cek Pembaruan` → "Pemeriksaan terakhir". Bila kosong/error,
kemungkinan server tidak punya akses internet atau GitHub sedang tidak
membalas. Lihat juga log aplikasi.

**Unduhan otomatis tidak jalan.**
Pastikan sakelar "Unduh installer di latar belakang" aktif dan
`update.auto.settings` belum diubah. Berkas installer harus ada di
`%LOCALAPPDATA%\erapor-pmk\updates\`.

**Pemasangan otomatis tidak dijalankan.**
Checklist: Windows? Installer terunduh? Aplikasi menganggur cukup lama? Waktu
sekarang di dalam jam pemasangan? Semua kondisi ini harus terpenuhi.

**Installer muncul sebagai aplikasi tak dikenal.**
Installer saat ini belum ditandatangani digital (lihat `docs/CODE_SIGNING.md`).
Windows SmartScreen bisa menampilkan peringatan; pilih "More info → Run anyway".

**Aplikasi tidak menyala setelah pembaruan.**
Buka `%LOCALAPPDATA%\erapor-pmk-data\logs\auto-update.log` dan
`erapor-pmk.log`. Jalankan ulang aplikasi lewat shortcut Start Menu bila perlu.
