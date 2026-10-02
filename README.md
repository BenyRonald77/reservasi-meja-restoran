# Reservasi Meja Restoran

Reservasi meja restoran dengan penggabungan meja otomatis: sistem mencarikan
kombinasi 1–3 meja yang bersebelahan sesuai jumlah tamu, mencegah double-booking,
mendukung check-in, dan otomatis melepas meja bila tamu tidak datang (sweep).

Stack: Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS.

## Cara Menjalankan

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Buka http://localhost:3000.

## Halaman

- `/` — Dashboard: denah & status meja per jam (tersedia/dipesan/diduduki/digabung),
  tombol "Jalankan Sweep", daftar reservasi + check-in/batal.
- `/reservasi` — Form reservasi dengan usulan kombinasi meja otomatis + alternatif.

## API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | /api/meja | List & tambah meja |
| POST | /api/adjacency | Tambah relasi adjacency |
| GET | /api/meja/status?tanggal&jam | Status semua meja per jam |
| GET | /api/kombinasi?tanggal&jamMulai&jamSelesai&jumlahTamu | Usulan kombinasi meja |
| GET/POST | /api/reservasi | List & buat reservasi (bentrok → 409) |
| GET | /api/reservasi/[id] | Detail reservasi |
| POST | /api/reservasi/[id]/checkin | Check-in → diduduki |
| POST | /api/reservasi/[id]/batal | Batalkan reservasi |
| POST | /api/sweep | Auto-release reservasi kedaluwarsa |

## Aturan penting

- Kombinasi terbaik: sisa kapasitas minimal, lalu jumlah meja minimal (maks 3 meja,
  harus saling terhubung via adjacency).
- Klaim meja atomik via transaksi Prisma — request bersamaan tidak double-booking.
- Sweep membatalkan reservasi `dipesan` yang jam mulainya lewat 15 menit tanpa check-in.
