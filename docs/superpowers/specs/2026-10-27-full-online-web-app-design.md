# Design Spec: Migrasi ke Full Online Web App (rapkumer-online)

## 1. Latar Belakang & Tujuan
Aplikasi e-Rapor sebelumnya dikembangkan dengan model desktop/offline-first hibrida (Windows InnoSetup installer, modul auto-update .exe, dan modul sinkronisasi database lokal SQLite ke Cloudflare D1). 
Klien menghendaki agar sistem berjalan **full online** sebagai aplikasi web terpusat tanpa instalasi desktop mandiri di komputer masing-masing pengguna dan tanpa kebutuhan fitur sinkronisasi data antar-database.

Tujuan proyek ini adalah:
1. Mengkloning basis kode ke direktori repositori terpisah (`D:\amar\pratamamulya\rapkumer-online`).
2. Menghapus seluruh komponen instalasi desktop Windows dan modul auto-update.
3. Menghapus seluruh rute, skema database, skrip, dan logika sinkronisasi Cloudflare D1.
4. Memastikan aplikasi siap dijalankan secara lokal (`pnpm dev` / `pnpm preview`) sebelum nantinya dideploy ke server online/VPS.
5. Menjaga integritas seluruh fitur utama e-Rapor (manajemen akademik, presensi, penilaian kognitif/formatif/sumatif, cetak rapor PDF PagedJS, manajemen pengguna & hak akses).

---

## 2. Arsitektur & Teknologi

- **Framework Web**: SvelteKit 2 + Svelte 5 runes (`$state`, `$derived`, `$props`).
- **Adapter**: `@sveltejs/adapter-node` (menghasilkan server Node.js standar di `build/index.js`).
- **Database**: SQLite lokal via `@libsql/client` dan Drizzle ORM.
  - Driver & konfigurasi tetap menggunakan `DB_URL` (default `file:./data/database.sqlite3`).
  - Mode SQLite WAL dan `PRAGMA synchronous = NORMAL` dipertahankan untuk performa optimal.
- **Penyimpanan Berkas (Uploads)**:
  - Berkas unggahan (foto profil, ttd, logo, lampiran murid) disimpan di direktori disk lokal `./data/uploads/`.
- **Cetak Dokumen PDF**:
  - PagedJS + Puppeteer Core server-side rendering.
  - Di lokal, menggunakan executable Chrome yang terinstal di komputer.
  - Di masa depan saat ke VPS, diarahkan ke Chromium headless via environment `PUPPETEER_EXECUTABLE_PATH`.

---

## 3. Komponen yang Dihapus (Pembersihan)

### 3.1 Artefak & Skrip Desktop Windows
- **Direktori `installer/`**: Berisi script InnoSetup (`.iss`), certificate codesigning, dan template bundling Windows. (Dihapus sepenuhnya).
- **Skrip Packaging**:
  - `scripts/prepare-windows.mjs`
  - `scripts/package-win.mjs`
  - `scripts/sync-to-installer.mjs`
  - `scripts/auto-update.mjs`
  - `scripts/start-erapor-pmk.mjs`
- **Background Updater**:
  - `src/lib/server/update-auto.ts`
  - Dokumen referensi: `docs/AUTO_UPDATE.md`, `docs/INSTALLER_WORKFLOW.md`, `docs/CODE_SIGNING.md`.
- **Package.json Scripts**:
  - Hapus command `package:win`, `sign:installer`, `package:win:installer`.

### 3.2 Modul Sinkronisasi Cloudflare D1
- **Rute UI & API**:
  - `src/routes/(administrasi)/sinkronisasi/` (seluruh subdirektori termasuk `import-data/`).
- **Logika Server**:
  - `src/lib/server/cloudflare-d1.ts`
  - `src/lib/server/cloud-master.ts`
- **Sub-project Cloud**:
  - Direktori `cloud/` (Cloudflare Worker API).
- **Skema Database & Migrasi**:
  - Hapus definisi tabel di `src/lib/server/db/schema.ts`:
    - `tableCloudSyncSettings`
    - `tableCloudSyncLogs`
    - `tableCloudPackages`
  - Hapus helper inisialisasi sinkronisasi dari `src/lib/server/db/ensure-*.ts` jika ada.
- **Hak Akses & Navigasi**:
  - Cabut permission `administrasi_sinkronisasi` dari `src/routes/pengguna/permissions.ts`.
  - Hapus navigasi menu "Sinkronisasi" dari sidebar/header di `src/lib/components/layout/sidebar.svelte` (atau komponen navigasi terkait).

---

## 4. Alur Kerja & Eksekusi

### Langkah 1: Kloning Repositori
- Duplikasi repositori aktif ke `D:\amar\pratamamulya\rapkumer-online`.
- Inisialisasi git baru atau branch bersih pada folder baru tersebut.

### Langkah 2: Pembersihan File & Dependensi
- Jalankan penghapusan berkas installer, auto-updater, dan sinkronisasi pada folder baru.
- Hapus dependensi package yang hanya dipakai installer (jika ada).
- Rapikan konfigurasi `.env.example` dan `.env` agar hanya menyisakan parameter web standar (`DB_URL`, `BODY_SIZE_LIMIT`, `PORT`, `ORIGIN`).

### Langkah 3: Penyesuaian Kode Sumber
- Bersihkan import `tableCloud*` di schema dan file database.
- Bersihkan menu sinkronisasi dari sidebar/layout dan matriks perizinan pengguna.
- Pastikan tidak ada referensi mati (`dangling imports`) ke `update-auto` atau `cloudflare-d1`.

### Langkah 4: Validasi & Testing Lokal
- Jalankan `pnpm check` (svelte-check) untuk memastikan 0 error TypeScript / komponen.
- Jalankan `pnpm lint` untuk konsistensi formatting.
- Jalankan `pnpm build` untuk memverifikasi proses bundling adapter-node.
- Jalankan `pnpm dev` untuk memverifikasi halaman web, otentikasi admin/guru, input nilai, presensi, dan cetak rapor berfungsi lancar.

---

## 5. Kriteria Keberhasilan (Acceptance Criteria)
1. Repositori `rapkumer-online` berdiri sendiri dan tidak bergantung pada direktori repo lama.
2. Tidak ada lagi menu atau rute `/sinkronisasi`.
3. Tidak ada lagi folder `installer/` maupun proses background auto-updater Windows.
4. `pnpm check` dan `pnpm build` selesai tanpa error.
5. Server web lokal dapat menyajikan aplikasi dengan data tersimpan di SQLite lokal tanpa error sinkronisasi.
