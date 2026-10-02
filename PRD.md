# PRD — Reservasi Meja Restoran dengan Penggabungan Meja

## Ringkasan
Aplikasi reservasi meja restoran. Tamu memesan slot jam (tanggal + jam mulai/selesai);
sistem mencarikan kombinasi meja terbaik — satu meja atau gabungan 2–3 meja yang
bersebelahan (adjacent) — sesuai jumlah tamu. Mencegah double-booking, mendukung
check-in, dan otomatis melepas meja bila tamu tidak datang (auto-release sweep).

## Stack
Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS, App Router.

## Model Data
- **Meja**: `nomor` (unik), `kapasitas`, `posX/posY` (denah), `aktif`.
- **Adjacency**: pasangan meja yang bersebelahan & boleh digabung (mejaAId < mejaBId).
- **Reservasi**: `tanggal` (YYYY-MM-DD), `jamMulai/jamSelesai` (HH:MM), `namaTamu`,
  `jumlahTamu`, `kontak`, `status` (`dipesan` | `diduduki` | `selesai` | `dibatalkan`).
- **ReservasiMeja**: join reservasi ↔ meja (satu reservasi bisa memakai 1–3 meja).

## Aturan Bisnis
1. **Kombinasi meja terbaik** (`GET /api/kombinasi`): untuk N tamu pada slot jam,
   cari dari meja bebas (tidak overlap reservasi aktif):
   - Prioritas 1 meja dengan kapasitas ≥ N dan sisa kapasitas minimal.
   - Jika tidak ada, kombinasi 2–3 meja yang membentuk satu komponen terhubung
     lewat relasi adjacency, total kapasitas ≥ N, sisa minimal (lalu jumlah meja
     minimal). Kembalikan `dipilih` + hingga 3 `alternatif`.
2. **Cegah bentrok** (`POST /api/reservasi`): overlap = `jamMulai < selesai_lama &&
   jamSelesai > mulai_lama` pada tanggal sama & status `dipesan`/`diduduki`,
   diperiksa **per meja** (termasuk meja yang sedang tergabung di reservasi lain).
   Bentrok → `409`. Klaim meja dilakukan dalam **transaksi Prisma atomik**:
   tulis reservasi dulu (kunci tulis SQLite + `busy_timeout`), lalu cek bentrok,
   lalu tulis ReservasiMeja — request bersamaan tidak bisa double-booking.
3. **Check-in** (`POST /api/reservasi/[id]/checkin`): `dipesan` → `diduduki`
   (404 bila tidak ada, 409 bila status bukan `dipesan`).
4. **Auto-release sweep** (`POST /api/sweep`): reservasi `dipesan` dengan
   `tanggal < hari_ini` ATAU (`tanggal = hari_ini` DAN `jamMulai ≤ sekarang − 15 mnt`)
   otomatis → `dibatalkan`, mejanya bebas lagi. Toleransi default 15 menit.
5. **Status meja realtime** (`GET /api/meja/status?tanggal&jam`): per meja →
   `tersedia` | `dipesan` | `diduduki` | `digabung` (dipakai reservasi multi-meja).
6. Validasi input → `400` (format tanggal/jam salah, jam selesai ≤ jam mulai,
   jumlah tamu < 1, kapasitas meja tidak cukup).

## API
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | /api/meja | List & tambah meja |
| POST | /api/adjacency | Tambah relasi adjacency {mejaAId, mejaBId} |
| GET | /api/meja/status?tanggal&jam | Status semua meja per jam |
| GET | /api/kombinasi?tanggal&jamMulai&jamSelesai&jumlahTamu | Usulan kombinasi meja |
| GET/POST | /api/reservasi | List (filter tanggal/status) & buat reservasi |
| GET | /api/reservasi/[id] | Detail reservasi |
| POST | /api/reservasi/[id]/checkin | Check-in tamu |
| POST | /api/reservasi/[id]/batal | Batalkan reservasi |
| POST | /api/sweep | Jalankan auto-release |

## Halaman UI (Bahasa Indonesia)
- `/` — Dashboard: denah/status meja per jam (pilih tanggal+jam), tombol "Jalankan
  Sweep", daftar reservasi hari ini + tombol check-in/batal.
- `/reservasi` — Form reservasi: isi tanggal/jam/nama/jumlah tamu → tampilkan
  usulan kombinasi meja otomatis + alternatif → pilih & simpan.

## Seed
8 meja (kapasitas 2–8) dengan relasi adjacency bentuk grid, + 2 reservasi contoh.
