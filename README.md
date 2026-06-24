# Sistem Pengurusan Kokurikulum SK Darau

Web app pengurusan kokurikulum (PAJSK) — dashboard, CRUD penuh, laporan & eksport.
Frontend **Vite + React**, backend **API berasingan (Hono)**, database **Supabase
Postgres**, hosting **Vercel**.

## Ciri

- **Dashboard** — statistik & carta dikira automatik daripada data sebenar.
- **CRUD penuh** — Murid, Unit (Kelab/Beruniform/Sukan), Penyertaan/Ahli, Markah
  PAJSK (gred auto), Kehadiran, Pencapaian, Takwim Aktiviti.
- **Laporan** individu & unit, **eksport** Excel + PDF, cetak.
- **Auth** admin tunggal (kata laluan) — baca terbuka, tulis perlu log masuk.

## Stack

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | Vite, React, React Router, TanStack Query |
| Backend | Hono (Vercel Edge Functions, `/api/*`) |
| Database | Supabase Postgres (`@supabase/supabase-js`, service-role) |
| Auth | JWT cookie (`jose`) + env `ADMIN_PASSWORD` |
| Eksport | SheetJS (xlsx), jsPDF |

## Setup tempatan

1. **Pasang dependency**
   ```bash
   npm install
   ```
2. **Cipta projek Supabase** (free) → jalankan `supabase/schema.sql` dalam SQL Editor.
3. **Env** — salin `.env.example` ke `.env` dan isi:
   ```
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, JWT_SECRET
   ```
4. **Jalankan** (frontend + API serentak):
   ```bash
   vercel dev
   ```
   Buka http://localhost:3000

> `npm run dev` jalankan frontend sahaja (tiada API). Guna `vercel dev` untuk penuh.

## Deploy ke Vercel

```bash
vercel link
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ADMIN_PASSWORD production
vercel env add JWT_SECRET production
vercel --prod
```

## Struktur

```
api/[...route].ts     # Hono app — semua route /api/*
api/_lib/             # supabase client, auth, crud factory
src/pages/            # satu fail per tab
src/layout/           # sidebar, topbar, footer
src/lib/              # api client, hooks, auth, toast, export
shared/types.ts       # jenis dikongsi frontend + API
supabase/schema.sql   # skema database
```

## Keselamatan

- `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server (`api/`), tidak pernah
  dihantar ke pelayar.
- Semua route tulis (POST/PUT/DELETE) dilindungi middleware auth.
