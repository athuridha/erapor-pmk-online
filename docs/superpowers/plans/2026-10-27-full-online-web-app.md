# Full Online Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengkloning e-rapor ke direktori baru `rapkumer-online`, membersihkan seluruh artefak desktop Windows (installer & auto-update) dan modul sinkronisasi Cloudflare D1, sehingga aplikasi beroperasi murni sebagai web app terpusat (SvelteKit + SQLite lokal).

**Architecture:** Menggunakan arsitektur web client-server tunggal berbasis SvelteKit 2 dengan `@sveltejs/adapter-node` dan SQLite lokal `@libsql/client` dalam mode WAL. Mengalihkan fitur "Impor Data Pokok Excel" dari subdirektori `/sinkronisasi/import-data` menjadi rute independen `/import-data`, serta membuang seluruh ketergantungan Cloudflare D1 dan installer Windows.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Drizzle ORM, @libsql/client (SQLite), TailwindCSS 4, DaisyUI 5, Puppeteer-Core + PagedJS.

## Global Constraints
- Target direktori repositori baru: `D:\amar\pratamamulya\rapkumer-online`.
- Repositori asli (`rapkumer-main`) tetap utuh sebagai arsip desktop.
- Database lokal SQLite (`./data/database.sqlite3`) tetap digunakan tanpa perubahan struktur tabel inti akademik/rapor.
- Seluruh file yang dihapus tidak boleh meninggalkan dangling import yang merusak `pnpm check` atau `pnpm build`.

---

### Task 1: Kloning Repositori & Konfigurasi Lingkungan Baru

**Files:**
- Create: `D:\amar\pratamamulya\rapkumer-online\` (full repository clone via git / filesystem copy)
- Modify: `D:\amar\pratamamulya\rapkumer-online\.env`
- Modify: `D:\amar\pratamamulya\rapkumer-online\.env.example`
- Modify: `D:\amar\pratamamulya\rapkumer-online\package.json`

**Interfaces:**
- Consumes: Existing git repository in `D:\amar\pratamamulya\rapkumer-main`
- Produces: Standalone project directory `D:\amar\pratamamulya\rapkumer-online` with clean environment configuration

- [ ] **Step 1: Klon repo ke direktori sibling rapkumer-online**

Run PowerShell command:
```powershell
git clone "D:\amar\pratamamulya\rapkumer-main" "D:\amar\pratamamulya\rapkumer-online"
```

- [ ] **Step 2: Bersihkan konfigurasi environment .env dan .env.example**

Di `D:\amar\pratamamulya\rapkumer-online\.env.example`:
Hapus bagian kredensial Cloudflare D1 (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_HTTP_URL`), sisakan:
```env
DB_URL="file:./data/database.sqlite3"
BODY_SIZE_LIMIT="512K"
PORT=5173
ORIGIN=""
```
Salin ke `D:\amar\pratamamulya\rapkumer-online\.env`.

- [ ] **Step 3: Bersihkan skrip Windows di package.json**

Di `D:\amar\pratamamulya\rapkumer-online\package.json`:
Hapus scripts:
- `"package:win"`
- `"package:win:installer"`
- `"sign:executables"`
- `"sign:installer"`
- `"sign:verify"`
- `"sign:setup"`
- `"sign:create-cert"`
- `"sign:create-cert:force"`

- [ ] **Step 4: Commit perubahan setup dasar di rapkumer-online**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add .env.example package.json
git commit -m "chore: setup clean online environment configuration"
```

---

### Task 2: Hapus Artefak & Skrip Desktop Windows

**Files:**
- Delete: `installer/`
- Delete: `scripts/prepare-windows.mjs`
- Delete: `scripts/package-win.mjs`
- Delete: `scripts/sync-to-installer.mjs`
- Delete: `scripts/auto-update.mjs`
- Delete: `scripts/build-installer.mjs`
- Delete: `scripts/start-erapor-pmk.mjs`
- Delete: `docs/INSTALLER_WORKFLOW.md`
- Delete: `docs/CODE_SIGNING.md`
- Delete: `docs/AUTO_UPDATE.md`

**Interfaces:**
- Consumes: None
- Produces: File tree free of Windows installer scripts and binary generators

- [ ] **Step 1: Hapus folder installer dan scripts windows**

Run PowerShell command di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
Remove-Item -Recurse -Force installer
Remove-Item -Force scripts/prepare-windows.mjs, scripts/sync-to-installer.mjs, scripts/auto-update.mjs, scripts/build-installer.mjs, scripts/start-erapor-pmk.mjs
Remove-Item -Force docs/INSTALLER_WORKFLOW.md, docs/CODE_SIGNING.md, docs/AUTO_UPDATE.md
```

- [ ] **Step 2: Commit penghapusan artefak desktop**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add -A
git commit -m "chore: remove windows installer and desktop packaging scripts"
```

---

### Task 3: Hapus Background Auto-Updater & Komponen Update Windows

**Files:**
- Delete: `src/lib/server/update-auto.ts`
- Delete: `src/lib/server/update-manager.ts`
- Delete: `src/routes/api/updates/`
- Delete: `src/lib/components/settings/update-notifier.svelte`
- Delete: `src/lib/components/settings/update-modal.svelte`
- Modify: `src/hooks.server.ts:18-35`
- Modify: `src/routes/+layout.svelte:20-25`
- Modify: `src/lib/components/settings/app-info-card.svelte`

**Interfaces:**
- Consumes: SvelteKit root layout & server hooks
- Produces: Server lifecycle without background release-checking timers

- [ ] **Step 1: Hapus file update-auto, update-manager, rute API updates, dan komponen UI modal update**

Run PowerShell command di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
Remove-Item -Force src/lib/server/update-auto.ts, src/lib/server/update-manager.ts
Remove-Item -Recurse -Force src/routes/api/updates
Remove-Item -Force src/lib/components/settings/update-notifier.svelte, src/lib/components/settings/update-modal.svelte
```

- [ ] **Step 2: Bersihkan hooks.server.ts**

Di `D:\amar\pratamamulya\rapkumer-online\src\hooks.server.ts`:
Hapus import:
```typescript
import { startUpdateScheduler } from '$lib/server/update-auto';
```
Dan hapus pemanggilan `startUpdateScheduler()` di inisialisasi background IIFE.

- [ ] **Step 3: Bersihkan +layout.svelte dan app-info-card.svelte**

Di `D:\amar\pratamamulya\rapkumer-online\src\routes\+layout.svelte`:
Hapus import dan tag `<UpdateNotifier />`.

Di `D:\amar\pratamamulya\rapkumer-online\src\lib\components\settings\app-info-card.svelte`:
Hapus tombol "Periksa Pembaruan" dan prop `oncheckupdate`.

- [ ] **Step 4: Commit perubahan pembersihan auto-updater**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add -A
git commit -m "refactor: remove desktop auto-update scheduler and UI"
```

---

### Task 4: Pindahkan Impor Data Pokok Excel & Hapus Modul Sinkronisasi D1

**Files:**
- Move: `src/routes/(administrasi)/sinkronisasi/import-data` -> `src/routes/(administrasi)/import-data`
- Delete: `src/routes/(administrasi)/sinkronisasi/`
- Delete: `src/lib/server/cloudflare-d1.ts`
- Delete: `src/lib/server/cloud-master.ts`
- Delete: `cloud/`
- Modify: `src/routes/(administrasi)/import-data/+page.svelte` (update link template)
- Modify: `src/routes/(administrasi)/import-data/+page.server.ts` (update import relative path)

**Interfaces:**
- Consumes: Excel import logic (`$lib/server/import-data/*`)
- Produces: Standalone `/import-data` route; zero Cloudflare D1 dependencies

- [ ] **Step 1: Pindahkan subfolder import-data ke (administrasi)/import-data**

Run PowerShell command di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
Move-Item "src/routes/(administrasi)/sinkronisasi/import-data" "src/routes/(administrasi)/import-data"
Remove-Item -Recurse -Force "src/routes/(administrasi)/sinkronisasi"
Remove-Item -Force src/lib/server/cloudflare-d1.ts, src/lib/server/cloud-master.ts
Remove-Item -Recurse -Force cloud
```

- [ ] **Step 2: Perbaiki path import dan template link di import-data**

Di `src/routes/(administrasi)/import-data/+page.server.ts`:
Ubah relative import `authority`:
```typescript
import { authority } from '../../pengguna/utils.server';
```
Di `src/routes/(administrasi)/import-data/+page.svelte`:
Ubah link template:
```html
<a class="btn btn-soft btn-sm shadow-none" href="/import-data/template">
```

- [ ] **Step 3: Commit pemindahan rute impor data & penghapusan modul sinkronisasi**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add -A
git commit -m "feat: migrate excel import to /import-data and remove cloud sync module"
```

---

### Task 5: Bersihkan Skema Database & Matriks Hak Akses (Permissions)

**Files:**
- Modify: `src/lib/server/db/schema.ts` (hapus `tableCloudSyncSettings`, `tableCloudPackages`, `tableCloudSyncLogs`)
- Modify: `src/routes/+page.server.ts` (hapus query `tableCloudSyncSettings`)
- Modify: `src/routes/+page.svelte` (hapus banner "Data Master Belum Disinkronkan")
- Modify: `src/routes/pengguna/permissions.ts` (pensiunkan `administrasi_sinkronisasi`, sesuaikan rute `/import-data`)

**Interfaces:**
- Consumes: Drizzle ORM schema definitions
- Produces: Clean SQLite schema without cloud sync tables and accurate permission list

- [ ] **Step 1: Bersihkan schema.ts**

Di `src/lib/server/db/schema.ts`:
Hapus deklarasi:
- `tableCloudSyncSettings`
- `tableCloudPackages`
- `tableCloudPackagesRelations`
- `tableCloudSyncLogs`

- [ ] **Step 2: Bersihkan +page.server.ts dan +page.svelte di dashboard utama**

Di `src/routes/+page.server.ts`:
Hapus import `tableCloudSyncSettings` dan query-nya di `Promise.all`.
Hapus kembalian `syncSettings` dari load function.

Di `src/routes/+page.svelte`:
Hapus block banner `{#if syncNeeded} ... {/if}` yang merujuk ke `/sinkronisasi`.

- [ ] **Step 3: Perbarui permissions.ts**

Di `src/routes/pengguna/permissions.ts`:
1. Hapus `['sinkronisasi', 'Sinkronisasi Database Pusat']` dari grup `administrasi`.
2. Tambahkan `'administrasi_sinkronisasi'` ke dalam `removedLegacyPermissionKeys`.
3. Perbarui `menuRoutePermissions`:
   Ubah:
   `{ path: '/sinkronisasi/import-data', permission: 'informasi_umum_sekolah' }`
   Menjadi:
   `{ path: '/import-data', permission: 'informasi_umum_sekolah' }`
   Dan hapus baris `{ path: '/sinkronisasi', permission: 'administrasi_sinkronisasi' }`.

- [ ] **Step 4: Commit pembersihan skema & permissions**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add -A
git commit -m "refactor: remove cloud sync tables and retire sinkronisasi permission"
```

---

### Task 6: Perbarui Navigasi & Tautan UI

**Files:**
- Modify: `src/lib/components/menu.ts`
- Modify: `src/lib/components/dashboard/quick-actions-card.svelte`

**Interfaces:**
- Consumes: Navigation menu definition
- Produces: Sidebar and quick actions without sync references; updated "Impor Data" link

- [ ] **Step 1: Perbarui menu.ts**

Di `src/lib/components/menu.ts`:
Ganti menu grup `Sinkronisasi`:
Hapus item `Database Pusat` (`/sinkronisasi`).
Ganti menu `Impor Data` jalurnya menjadi `/import-data`.
Bila perlu, ubah judul menu grup menjadi `Impor Data` atau gabungkan ke menu `Administrasi`.

- [ ] **Step 2: Perbarui quick-actions-card.svelte**

Di `src/lib/components/dashboard/quick-actions-card.svelte`:
Hapus tombol "Sinkronisasi Data" (`/sinkronisasi`).
Ubah tautan "Impor Data Pokok" dari `/sinkronisasi/import-data` menjadi `/import-data`.

- [ ] **Step 3: Commit perubahan navigasi menu**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git add -A
git commit -m "chore: update menu navigation and dashboard quick actions"
```

---

### Task 7: Validasi Kode & Verifikasi Runtime Lokal

**Files:**
- Verify: Full codebase integrity in `D:\amar\pratamamulya\rapkumer-online`

**Interfaces:**
- Consumes: pnpm toolchain (svelte-check, vite build)
- Produces: Passing type-check and successful production build artifacts

- [ ] **Step 1: Install dependencies & sync SvelteKit**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
pnpm install
pnpm prepare
```
Expected: PASS

- [ ] **Step 2: Jalankan typecheck svelte-check**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
pnpm check
```
Expected: 0 errors

- [ ] **Step 3: Jalankan production build**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```powershell
pnpm build
```
Expected: Build successfully created in `build/`

- [ ] **Step 4: Commit hasil verifikasi & push ke repo baru**

Run di `D:\amar\pratamamulya\rapkumer-online`:
```bash
git status
```
Pastikan tree bersih dan siap dijalankan via `pnpm dev`.
