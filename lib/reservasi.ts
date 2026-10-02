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
 * Buat reservasi secara atomik dengan pola conditional single-statement
 * (analog dengan `updateMany({ where: {..., status:'X'} })` + cek row count):
 *
 *  1. INSERT parent Reservasi (single statement, selalu sukses).
 *  2. INSERT INTO ReservasiMeja (reservasiId, mejaId)
 *     SELECT ... WHERE NOT EXISTS (
 *       SELECT 1 FROM ReservasiMeja rm JOIN Reservasi r ...
 *       WHERE rm.mejaId IN (...) AND rm.reservasiId <> <punyaku>
 *         AND r.tanggal = ? AND r.status IN ('dipesan','diduduki')
 *         AND overlap jam
 *     )
 *     -> single statement = atomic di SQLite (implicit transaction + write
 *     lock). Dua request bersamaan diserialisasi oleh SQLite: pemenang
 *     menulis N baris, yang kalah mendapat 0 baris.
 *  3. affected rows != N -> hapus parent yatim, lempar 409.
 *     affected rows == N -> sukses.
 *
 * Tidak memakai interactive prisma.$transaction untuk konkurensi (terbukti
 * tidak tahan race di SQLite: 500/lock-timeout) dan tidak memakai mutex
 * aplikasi. Retry kecil hanya untuk SQLITE_BUSY sesaat; kondisi kalah race
 * terdeteksi deterministik via row count, bukan via exception.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isBusyError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return m.includes("database is locked") || m.includes("SQLITE_BUSY") || m.includes("timed out");
};

export async function buatReservasi(input: ReservasiInput) {
  let mejaIds = input.mejaIds;
  if (!mejaIds || mejaIds.length === 0) {
    // Usulan otomatis; klaim kondisional di bawah memverifikasi ulang,
    // jadi race antara usulan dan klaim tetap tertangkap sebagai 409.
    const { dipilih } = await cariKombinasi(
      input.tanggal, input.jamMulai, input.jamSelesai, input.jumlahTamu
    );
    if (!dipilih)
      throw new HttpError(409, "Tidak ada meja tersedia untuk jumlah tamu dan jam tersebut");
    mejaIds = dipilih.meja.map((m) => m.id);
  } else {
    mejaIds = [...new Set(mejaIds)];
    const ada = await prisma.meja.count({ where: { id: { in: mejaIds }, aktif: true } });
    if (ada !== mejaIds.length) throw new HttpError(400, "Ada meja yang tidak dikenal / tidak aktif");
    const total = await prisma.meja.aggregate({
      where: { id: { in: mejaIds } },
      _sum: { kapasitas: true },
    });
    if ((total._sum.kapasitas ?? 0) < input.jumlahTamu)
      throw new HttpError(400, "Total kapasitas meja kurang dari jumlah tamu");
  }

  // 1. Parent row (single statement)
  const reservasi = await prisma.reservasi.create({
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

  // 2. Klaim meja kondisional (single statement)
  const values = mejaIds.map(() => "SELECT ? AS mejaId").join(" UNION ALL ");
  const inList = mejaIds.map(() => "?").join(",");
  const sql = `INSERT INTO ReservasiMeja (reservasiId, mejaId)
    SELECT ? AS reservasiId, v.mejaId FROM (${values}) AS v
    WHERE NOT EXISTS (
      SELECT 1 FROM ReservasiMeja rm
      JOIN Reservasi r ON r.id = rm.reservasiId
      WHERE rm.mejaId IN (${inList})
        AND rm.reservasiId <> ?
        AND r.tanggal = ?
        AND r.status IN ('dipesan', 'diduduki')
        AND r.jamMulai < ? AND r.jamSelesai > ?
    )`;
  const params: (string | number)[] = [
    reservasi.id,
    ...mejaIds,
    ...mejaIds,
    reservasi.id,
    input.tanggal,
    input.jamSelesai,
    input.jamMulai,
  ];
  let affected = -1;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      affected = await prisma.$executeRawUnsafe(sql, ...params);
      break;
    } catch (e) {
      if (attempt === 2 || !isBusyError(e)) throw e;
      await sleep(60 * (attempt + 1));
    }
  }

  // 3. 0 baris (atau < N) = kalah race -> bersihkan parent yatim -> 409
  if (affected !== mejaIds.length) {
    await prisma.reservasi.delete({ where: { id: reservasi.id } }).catch(() => undefined);
    const bentrok = await prisma.reservasiMeja.findMany({
      where: {
        mejaId: { in: mejaIds },
        reservasi: {
          tanggal: input.tanggal,
          status: { in: ["dipesan", "diduduki"] },
          jamMulai: { lt: input.jamSelesai },
          jamSelesai: { gt: input.jamMulai },
        },
      },
      include: { meja: true },
    });
    const nama = [...new Set(bentrok.map((b) => b.meja.nomor))].join(", ");
    throw new HttpError(409, `Meja ${nama} sudah dipesan pada jam tersebut`);
  }

  return prisma.reservasi.findUniqueOrThrow({
    where: { id: reservasi.id },
    include: { meja: { include: { meja: true } } },
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
