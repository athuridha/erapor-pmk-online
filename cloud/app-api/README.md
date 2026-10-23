# API Database Pusat (worker proxy D1)

Worker `erapor-d1-api` berperan sebagai gerbang tunggal ke Database Pusat di
Cloudflare D1. Aplikasi e-Rapor tidak lagi menyimpan token Cloudflare yang
cepat kedaluwarsa — ia memanggil worker ini dengan satu kunci statis.

```
Aplikasi --HTTPS (Bearer API key)--> Worker (binding D1) --> Database D1-pusat
```

## Deploy (sekali saja)

```sh
cd cloud/app-api
pnpm dlx wrangler login                  # buka browser, izinkan akses
pnpm dlx wrangler secret put API_KEY     # tempel kunci acak, mis. hasil `wrangler utils random 32`
pnpm dlx wrangler deploy
```

Catat URL `https://erapor-d1-api.<subdomain>.workers.dev` dari output deploy.

## Aktifkan di aplikasi

Dua cara, pilih salah satu:

1. **Env**: tambahkan di `.env` server:
   ```
   CLOUDFLARE_API_URL=https://erapor-d1-api.<subdomain>.workers.dev/query
   CLOUDFLARE_API_TOKEN=<kunci API_KEY yang sama>
   ```
   Token `CLOUDFLARE_API_TOKEN` di sini bukan token Cloudflare, melainkan kunci
   statis yang dibandingkan worker terhadap `API_KEY`.
2. **Database**: simpan lewat `POST /api/cloud/settings` dengan
   `apiUrl` + `apiToken`.

Selama `CLOUDFLARE_API_URL` terisi, semua kuery lewat
`src/lib/server/cloudflare-d1.ts` memakai worker ini. Hapus huruf yang
tersimpan di env untuk kembali ke mode token Cloudflare lama.
