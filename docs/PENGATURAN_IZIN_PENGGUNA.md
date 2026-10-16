# Pengaturan Izin Pengguna

Dua lapis pengaturan, dan keduanya berdiri sendiri:

1. **Template per tipe akun** — `admin`, `kepala_sekolah`, `wali_kelas`, `wali_asuh`, `user` (guru). Template dipakai saat akun dibuat dan bisa diterapkan ulang kapan saja lewat tombol **Terapkan template**.
2. **Izin per akun** — admin bisa menyalakan atau mematikan izin mana pun untuk akun mana pun. Setelah admin menyentuh satu izin, akun itu berjalan dengan set sendiri; template tidak lagi menimpanya.

---

## Lokasi

| Bagian                    | Berkas                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Daftar izin & template    | `src/routes/pengguna/permissions.ts:1` (`groupedUserPermissions`), `:84` (`defaultPermissionsByType`)      |
| Halaman izin per akun     | `src/routes/pengguna/[id]/+page.svelte:73` (form `?/set_permissions`), `:133` (form `?/reset_permissions`) |
| Server action izin        | `src/routes/pengguna/[id]/+page.server.ts:29` (`set_permissions`), `:37` (`reset_permissions`)             |
| Pembuatan akun            | `src/routes/pengguna/form/[[id]]/+page.server.ts:210`                                                      |
| Seksi "Hak Akses" di form | `src/routes/pengguna/form/[[id]]/+page.svelte` (toggle per izin, dikirim sebagai `permissions` JSON)       |
| Route guard               | `src/hooks.server.ts:292`                                                                                  |

Alur admin:

- `GET /pengguna/[id]` → tabel semua izin, toggle per izin, tombol **Simpan** dan **Terapkan template**.
- Toggle `checked` = izin aktif. Menyimpan mengirim seluruh key yang tercentang sebagai set izin baru (bukan penambahan).
- **Terapkan template** mengembalikan akun ke `defaultPermissionsByType[type]` — berguna setelah role akun ditukar atau setelah admin salah matikan izin.

---

## Daftar Izin

Izin berformat `{grup}_{value}`. **Total 33 izin** dalam 10 grup.

| Grup           | Izin                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| user           | `user_list`, `user_detail`, `user_add`, `user_delete`, `user_suspend`, `user_set_permissions`                                                                                                                                                                                                          |
| dashboard      | `dashboard_manage`                                                                                                                                                                                                                                                                                     |
| app            | `app_check_update`                                                                                                                                                                                                                                                                                     |
| server         | `server_stop`                                                                                                                                                                                                                                                                                          |
| kelas          | `kelas_pindah`                                                                                                                                                                                                                                                                                         |
| informasi_umum | `informasi_umum_sekolah`, `informasi_umum_akademik`, `informasi_umum_kelas`, `informasi_umum_murid`                                                                                                                                                                                                    |
| mata_pelajaran | `mata_pelajaran_intrakurikuler`, `mata_pelajaran_kokurikuler`, `mata_pelajaran_ekstrakurikuler`                                                                                                                                                                                                        |
| input_nilai    | `input_nilai_asesmen_formatif`, `input_nilai_asesmen_sumatif`, `input_nilai_asesmen_kokurikuler`, `input_nilai_nilai_ekstrakurikuler`                                                                                                                                                                  |
| administrasi   | `administrasi_absen`, `administrasi_rpm`, `administrasi_jurnal_mengajar`, `administrasi_catatan_wali_kelas`, `administrasi_rekap_nilai`, `administrasi_keputusan`, `administrasi_buku_tamu`, `administrasi_presensi_guru`, `administrasi_sppd`, `administrasi_dinas_luar`, `administrasi_sinkronisasi` |
| cetak          | `cetak_dokumen`                                                                                                                                                                                                                                                                                        |

Dua izin di luar menu drawer:

- `kelas_pindah` (`kelas`) — izin fungsional: izinkan pindah dan membuka kelas lain. Bukan bagian dari template mana pun; hanya diberikan otomatis saat akun `user`/`wali_kelas` dibuat dengan lebih dari satu kelas.
- `dashboard_manage`, `app_check_update`, `server_stop`, `user_*` — kontrol aplikasi dan manajemen akun, hanya relevan untuk admin/kepala sekolah.

---

## Template per Tipe Akun

`defaultPermissionsByType` (`permissions.ts:84`). Admin dan kepala sekolah otomatis punya semua akses tanpa membaca daftar izin (`isAuthorizedUser`, `permissions.ts:193`).

### `wali_kelas` — 18 izin

`informasi_umum_murid`, `informasi_umum_kelas`, `mata_pelajaran_intrakurikuler`, `mata_pelajaran_kokurikuler`, `mata_pelajaran_ekstrakurikuler`, `input_nilai_asesmen_formatif`, `input_nilai_asesmen_sumatif`, `input_nilai_asesmen_kokurikuler`, `input_nilai_nilai_ekstrakurikuler`, `administrasi_absen`, `administrasi_rpm`, `administrasi_jurnal_mengajar`, `administrasi_catatan_wali_kelas`, `administrasi_rekap_nilai`, `administrasi_keputusan`, `administrasi_dinas_luar`, `administrasi_sinkronisasi`, `cetak_dokumen`.

Tanpa menu Sekolah, Akademik, Kelas, dan Buku Tamu.

### `user` (guru mapel) — 16 izin

Sama seperti `wali_kelas` **tanpa** `administrasi_catatan_wali_kelas` dan `administrasi_keputusan`.

### `wali_asuh` — 2 izin

`cetak_dokumen`, `administrasi_dinas_luar`.

Wali asuh bersifat per-murid (bukan per-kelas). Bila diberi izin menu lain lewat kustomisasi, aksesnya tetap mengikuti cakupan murid asuhannya.

### Ringkasan akses bawaan

| Kemampuan                        | Admin/Kepala | Wali Kelas | Wali Asuh | Guru |
| -------------------------------- | ------------ | ---------- | --------- | ---- |
| Menu Sekolah / Akademik / Kelas  | ✅           | ❌         | ❌        | ❌   |
| Menu Murid                       | ✅           | ✅         | ❌        | ✅   |
| Catatan Wali Kelas & Keputusan   | ✅           | ✅         | ❌        | ❌   |
| Buku Tamu / Presensi Guru / SPPD | ✅           | ❌         | ❌        | ❌   |
| Cetak dokumen                    | ✅           | ✅         | ✅        | ✅   |
| Edit presensi murid              | ✅           | ✅         | ❌        | ❌   |
| Isi Sekaligus (bulk per mapel)   | ✅           | ✅         | ❌        | ✅   |
| `canManageMapel`                 | ✅           | ✅         | ❌        | ✅   |
| Bisa dihapus dari `/pengguna`    | ✅           | ❌         | ❌        | ✅   |
| Akses kelas lain                 | ✅           | ❌         | ✅        | ❌   |

Catatan:

- `canUserEditAbsen` (`src/lib/server/absen/utils.ts:1`) hanya `true` untuk admin, kepala sekolah, dan wali kelas. Guru mapel hanya bisa **Isi Sekaligus** (`src/lib/server/absen/actions.ts:167`).
- `canManageMapel` (`src/routes/+layout.server.ts:404`) `false` hanya untuk `wali_asuh`.
- `disableInteraction` (`src/routes/+layout.svelte`) membuat akun `user` read-only di `/catatan-wali-kelas` dan `/keputusan`. Kini hanya relevan bila admin memang memberi izin itu ke guru.

---

## Kustomisasi Izin per Akun

- Halaman `/pengguna/[id]` menyimpan seluruh centang sebagai set izin akun tersebut, jadi admin bebas menambah **atau** mencabut izin bawaan.
- Form **Tambah/Edit Pengguna** (`/pengguna/form`) punya seksi **Hak Akses** dengan toggle yang sama. Akun baru mulai dari template role yang dipilih, akun lama mulai dari izin yang tersimpan. Mengganti role me-reset toggle ke template role baru; tombol **Sesuai template** mengembalikannya kapan saja.
- Izin yang tercentang dikirim sebagai satu nilai `permissions` (JSON array), lalu disaring di server: hanya key yang ada di `userPermissions` yang diterima, dan role `admin`/`kepala_sekolah` selalu ditulis sebagai daftar penuh.
- Mengubah tipe akun di `/pengguna/form/[[id]]` mengisi ulang izin sesuai template tipe baru (form action, `+page.server.ts:210`).
- Bila akun `user`/`wali_kelas` dibuat atau diubah untuk lebih dari satu kelas, `kelas_pindah` ditambahkan otomatis (`form/[[id]]/+page.server.ts:213`); bila kelasnya tinggal satu, izin itu dicabut (`:436-441`).
- Admin tidak bisa dikustomisasi — ia selalu punya semua akses.
- Aturan penjagaan tetap berlaku walau izin diberikan: mencabut izin menu memblokir route-nya di hooks, dan memberi izin tidak melewati pembatasan cakupan data (kelas/murid sendiri).

---

## Kapan Izin Dicek

1. **Hook** (`src/hooks.server.ts:292`) — setiap request dipetakan ke izin via `resolveRoutePermission()` (`permissions.ts:185`); tanpa izin → `303 /forbidden?required={izin}`.
2. **Guard `kelas_id`** (`src/hooks.server.ts:217`) — `wali_kelas` hanya boleh memakai `?kelas_id=` miliknya, kecuali punya `kelas_pindah`; `wali_asuh` bebas karena berbasis murid.
3. **Load & form action** — `authority()` (`src/routes/pengguna/utils.server.ts`) dan `isAuthorizedUser()` langsung.
4. **API** — `isAuthorizedUser()` di endpoint (`/api/runtime/stop`, `/api/updates/*`, `/api/sekolah/*`, dll).
5. **Client** — komponen `<Authority>` (`src/routes/pengguna/authority.svelte`) untuk elemen UI kondisional.
6. **Drawer** — `src/lib/components/menu.svelte` menyaring item menu; grup induk ikut hilang bila semua submenu terkunci.
7. **Read-only** — `disableInteraction` di `src/routes/+layout.svelte`.

Filter drawer tidak menggantikan guard server: akses URL langsung tetap diblokir hook.

---

## Visibilitas Menu Bawaan

| Menu                  | Admin/Kepala | Wali Kelas | Wali Asuh | Guru |
| --------------------- | ------------ | ---------- | --------- | ---- |
| Sekolah               | ✅           | ❌         | ❌        | ❌   |
| Akademik              | ✅           | ❌         | ❌        | ❌   |
| Kelas                 | ✅           | ✅         | ❌        | ✅   |
| Murid                 | ✅           | ✅         | ❌        | ✅   |
| Intrakurikuler        | ✅           | ✅         | ❌        | ✅   |
| Kokurikuler           | ✅           | ✅         | ❌        | ✅   |
| Ekstrakurikuler       | ✅           | ✅         | ❌        | ✅   |
| Asesmen Formatif      | ✅           | ✅         | ❌        | ✅   |
| Asesmen Sumatif       | ✅           | ✅         | ❌        | ✅   |
| Asesmen Kokurikuler   | ✅           | ✅         | ❌        | ✅   |
| Nilai Ekstrakurikuler | ✅           | ✅         | ❌        | ✅   |
| Presensi Murid        | ✅           | ✅         | ❌        | ✅   |
| RPM                   | ✅           | ✅         | ❌        | ✅   |
| Jurnal Mengajar       | ✅           | ✅         | ❌        | ✅   |
| Rekap Nilai           | ✅           | ✅         | ❌        | ✅   |
| Dinas Luar            | ✅           | ✅         | ✅        | ✅   |
| Sinkronisasi Cloud    | ✅           | ✅         | ❌        | ✅   |
| Cetak Dokumen         | ✅           | ✅         | ✅        | ✅   |
| Catatan Wali Kelas    | ✅           | ✅         | ❌        | ❌   |
| Keputusan             | ✅           | ✅         | ❌        | ❌   |
| Buku Tamu             | ✅           | ❌         | ❌        | ❌   |
| Presensi Guru         | ✅           | ❌         | ❌        | ❌   |
| SPPD                  | ✅           | ❌         | ❌        | ❌   |

Contoh cascading grup: untuk guru, grup **Informasi Umum** hilang seluruhnya (Sekolah/Akademik/Kelas/Murid terkunci) kecuali izin Murid dan Kelas yang memang jadi bawaan guru; grup **Input Nilai** tetap tampil karena keempat submenu terbuka.

---

## Migrasi Data Izin

Berjalan sekali per versi saat aplikasi start: `src/lib/server/db/ensure-permission-migration.ts`, marker `permission_model_version` di tabel `app_meta`.

Versi terakhir: **`menu-based-v6`**. Sejak v6 migrasi **tidak lagi menimpa izin akun**:

1. Buang key izin yang sudah dihapus dari produk (`removedLegacyPermissionKeys`, `permissions.ts:142`).
2. Isi default tipe akun hanya bila akun **belum punya izin sama sekali**.
3. Selain itu set izin akun dibiarkan apa adanya — termasuk akun `admin`.

Versi lama (v3–v5) sempat menimpa izin `wali_kelas`/`wali_asuh` dengan set default; perilaku itu dihentikan karena menghapus penyesuaian admin.

### Izin yang Sudah Dihapus

| Izin lama                        | Pengganti                                |
| -------------------------------- | ---------------------------------------- |
| `sekolah_manage`                 | `informasi_umum_sekolah`                 |
| `rapor_manage`                   | izin menu terkait (akademik/mapel/nilai) |
| `kelas_manage`                   | `informasi_umum_kelas`                   |
| `mata_pelajaran_keasramaan`      | — (fitur keasramaan dihapus)             |
| `input_nilai_asesmen_keasramaan` | — (fitur keasramaan dihapus)             |

---

## Catatan Teknis

- Izin disimpan sebagai JSON array di `auth_user.permissions` (`permissions TEXT NOT NULL DEFAULT '[]'`), tipe TypeScript `UserPermission` (`src/lib/types.d.ts`).
- Menyimpan = mengirim semua key tercentang, lalu `db.update(...).set({ permissions })` (`[id]/+page.server.ts:33`). Izin akun admin di halaman itu dirender tercentang + disabled beserta hidden input agar tetap terkirim.
- Role hanya menentukan template dan pembatasan cakupan (`kelas_id`, murid asuhan, mata pelajaran) — bukan daftar menu.
- Skrip `scripts/grant-admin-permissions.mjs` dan `scripts/seed-default-admin.mjs` menyamakan izin admin/kepala sekolah dengan daftar kanonik, dan membuang key yang sudah dihapus.
