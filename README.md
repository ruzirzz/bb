# CFrame Database Dashboard

Dashboard web untuk mengelola database CFrame teleporter Roblox Evade. Data disimpan di GitHub sebagai file Lua (`tp.lua`).

## Fitur

- **Dashboard** — Lihat progress map yang sudah punya koordinat teleporter
- **Ekstrak CFrame** — Paste raw dump Lua dari executor, otomatis ekstrak CFrame Teleporter
- **Tambah Map** — Tambah map baru ke database dengan autocomplete
- **Edit & Hapus** — Kelola map yang sudah tersimpan

## Setup

### Environment Variables (Railway)

| Variable | Deskripsi |
|----------|-----------|
| `GITHUB_TOKEN` | Personal Access Token GitHub (repo scope) |
| `GITHUB_OWNER` | Username/org pemilik repo |
| `GITHUB_REPO` | Nama repository |
| `GITHUB_PATH` | Path ke file tp.lua di repo (misal: `tp.lua`) |
| `API_KEY` | Key untuk proteksi endpoint write (opsional, tapi sangat disarankan) |
| `PORT` | Port server (default: 3000, Railway set otomatis) |

### Jalankan Lokal

```bash
npm install
# Set environment variables dulu, atau buat file .env
npm start
```

## Autentikasi

Endpoint POST (`/api/github`) dilindungi oleh API key. Kirim key via header `X-Api-Key` atau query param `?key=...`.

Di frontend, klik ikon 🔑 di sidebar untuk set API key (disimpan di localStorage browser).

Kalau `API_KEY` tidak di-set di environment, proteksi dinonaktifkan (dev mode).

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS
- **Storage**: GitHub API (file-based)
- **Deploy**: Railway

## API Endpoints

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| GET | `/api/github` | ❌ | Ambil konten tp.lua dari GitHub |
| POST | `/api/github` | ✅ | Update/commit tp.lua ke GitHub |
| GET | `/api/allmaps` | ❌ | Daftar semua nama map (dari allmaps.txt) |
| GET | `/api/health` | ❌ | Health check |
| GET | `/api/lastupdate` | ❌ | Info commit terakhir |
