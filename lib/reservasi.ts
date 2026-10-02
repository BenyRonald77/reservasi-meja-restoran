import { prisma } from "@/lib/prisma";
import { minusMinutes, nowTime, today } from "@/lib/format";
import { cariKombinasi, mejaTerpakaiIds } from "@/lib/kombinasi";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ReservasiInput = {
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  namaTamu: string;
  jumlahTamu: number;
  kontak?: string;
  mejaIds?: number[];
};

/**
 * Buat reservasi secara atomik: cek bentrok + insert dalam satu transaksi
 * interaktif dengan busy_timeout, sehingga dua request bersamaan tidak bisa
 * double-booking meja yang sama (yang kalah mendapat 409).
 */
// Antrean mutex proses-tunggal: klaim meja yang datang bersamaan dijalankan
// berurutan, sehingga tiap klaim melihat state yang sudah di-commit oleh
// klaim sebelumnya. Di dalam mutex, transaksi Prisma menjamin atomisitas
// cek-bentrok + insert (yang kalah mendapat 409, bukan 500/lock-timeout).
let antrean: Promise<unknown> = Promise.resolve();
function denganMutex<T>(fn: () => Promise<T>): Promise<T> {
  const hasil = antrean.then(fn, fn);
  antrean = hasil.then(
    () => undefined,
    () => undefined
  );
  return hasil;
}

export async function buatReservasi(input: ReservasiInput) {
  return denganMutex(() => klaimReservasi(input));
}

async function klaimReservasi(input: ReservasiInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe("PRAGMA busy_timeout = 10000");

    let mejaIds = input.mejaIds;
    if (!mejaIds || mejaIds.length === 0) {
      // Usulan otomatis: dibaca di luar tx, lalu DIVERIFIKASI ulang oleh cek
      // bentrok di dalam tx — jadi race tetap tertangkap sebagai 409.
      const { dipilih } = await cariKombinasi(input.tanggal, input.jamMulai, input.jamSelesai, input.jumlahTamu);
      if (!dipilih) throw new HttpError(409, "Tidak ada meja tersedia untuk jumlah tamu dan jam tersebut");
      mejaIds = dipilih.meja.map((m) => m.id);
    } else {
      const ada = await tx.meja.count({ where: { id: { in: mejaIds }, aktif: true } });
      if (ada !== mejaIds.length) throw new HttpError(400, "Ada meja yang tidak dikenal / tidak aktif");
      const total = await tx.meja.aggregate({
        where: { id: { in: mejaIds } },
        _sum: { kapasitas: true },
      });
      if ((total._sum.kapasitas ?? 0) < input.jumlahTamu)
        throw new HttpError(400, "Total kapasitas meja kurang dari jumlah tamu");
    }

    // Tulis dulu (kunci tulis SQLite) sebelum cek bentrok
    const reservasi = await tx.reservasi.create({
      data: {
        tanggal: input.tanggal,
        jamMulai: input.jamMulai,
        jamSelesai: input.jamSelesai,
        namaTamu: input.namaTamu,
        jumlahTamu: input.jumlahTamu,
        kontak: input.kontak ?? "",
        status: "dipesan",
        createdAt: new Date().toISOString(),
      },
    });

    const bentrok = await tx.reservasiMeja.findMany({
      where: {
        mejaId: { in: mejaIds },
        reservasiId: { not: reservasi.id },
        reservasi: {
          tanggal: input.tanggal,
          status: { in: ["dipesan", "diduduki"] },
          jamMulai: { lt: input.jamSelesai },
          jamSelesai: { gt: input.jamMulai },
        },
      },
      include: { meja: true, reservasi: true },
    });
    if (bentrok.length > 0) {
      const nama = [...new Set(bentrok.map((b) => b.meja.nomor))].join(", ");
      throw new HttpError(409, `Meja ${nama} sudah dipesan pada jam tersebut`);
    }

    await tx.reservasiMeja.createMany({
      data: mejaIds.map((mejaId) => ({ reservasiId: reservasi.id, mejaId })),
    });

    return tx.reservasi.findUniqueOrThrow({
      where: { id: reservasi.id },
      include: { meja: { include: { meja: true } } },
    });
  });
}

/** Sweep: batalkan reservasi "dipesan" yang lewat batas toleransi tanpa check-in. */
export function serializeReservasi(r: {
  id: number; tanggal: string; jamMulai: string; jamSelesai: string;
  namaTamu: string; jumlahTamu: number; kontak: string; status: string;
  checkedInAt: string;
  meja: { meja: { id: number; nomor: string; kapasitas: number } }[];
}) {
  return {
    id: r.id,
    tanggal: r.tanggal,
    jamMulai: r.jamMulai,
    jamSelesai: r.jamSelesai,
    namaTamu: r.namaTamu,
    jumlahTamu: r.jumlahTamu,
    kontak: r.kontak,
    status: r.status,
    checkedInAt: r.checkedInAt || null,
    meja: r.meja.map((rm) => ({ id: rm.meja.id, nomor: rm.meja.nomor, kapasitas: rm.meja.kapasitas })),
  };
}
export async function sweepAutoRelease(toleransiMenit = 15) {
  const tgl = today();
  const batas = minusMinutes(nowTime(), toleransiMenit);
  const kadaluarsa = await prisma.reservasi.findMany({
    where: {
      status: "dipesan",
      OR: [{ tanggal: { lt: tgl } }, { tanggal: tgl, jamMulai: { lte: batas } }],
    },
    include: { meja: { include: { meja: true } } },
  });
  const ids = kadaluarsa.map((r) => r.id);
  if (ids.length > 0) {
    await prisma.reservasi.updateMany({ where: { id: { in: ids } }, data: { status: "dibatalkan" } });
  }
  return {
    dibatalkan: ids.length,
    reservasi: kadaluarsa.map((r) => ({
      id: r.id,
      namaTamu: r.namaTamu,
      tanggal: r.tanggal,
      jamMulai: r.jamMulai,
      meja: r.meja.map((rm) => rm.meja.nomor),
    })),
  };
}

export { mejaTerpakaiIds };
