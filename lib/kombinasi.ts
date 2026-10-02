import { prisma } from "@/lib/prisma";

export type MejaInfo = { id: number; nomor: string; kapasitas: number };
export type Kombinasi = {
  meja: MejaInfo[];
  totalKapasitas: number;
  sisaKapasitas: number;
  gabungan: boolean;
};

const STATUS_AKTIF = ["dipesan", "diduduki"];

/** ID meja yang sedang dipakai (overlap) pada slot tanggal+jam. */
export async function mejaTerpakaiIds(
  tanggal: string,
  jamMulai: string,
  jamSelesai: string,
  excludeReservasiId?: number
): Promise<Set<number>> {
  const rows = await prisma.reservasiMeja.findMany({
    where: {
      reservasi: {
        tanggal,
        status: { in: STATUS_AKTIF },
        jamMulai: { lt: jamSelesai },
        jamSelesai: { gt: jamMulai },
        ...(excludeReservasiId ? { id: { not: excludeReservasiId } } : {}),
      },
    },
    select: { mejaId: true },
  });
  return new Set(rows.map((r) => r.mejaId));
}

type Node = MejaInfo & { tetangga: number[] };

/** Cari kombinasi terbaik untuk N tamu. Mengembalikan {dipilih, alternatif}. */
export async function cariKombinasi(
  tanggal: string,
  jamMulai: string,
  jamSelesai: string,
  jumlahTamu: number
): Promise<{ dipilih: Kombinasi | null; alternatif: Kombinasi[] }> {
  const [mejas, adj, terpakai] = await Promise.all([
    prisma.meja.findMany({ where: { aktif: true }, orderBy: { id: "asc" } }),
    prisma.adjacency.findMany(),
    mejaTerpakaiIds(tanggal, jamMulai, jamSelesai),
  ]);

  const bebas: Node[] = mejas
    .filter((m) => !terpakai.has(m.id))
    .map((m) => ({ id: m.id, nomor: m.nomor, kapasitas: m.kapasitas, tetangga: [] }));
  const byId = new Map(bebas.map((m) => [m.id, m]));
  for (const a of adj) {
    const x = byId.get(a.mejaAId);
    const y = byId.get(a.mejaBId);
    if (x && y) {
      x.tetangga.push(y.id);
      y.tetangga.push(x.id);
    }
  }

  const kandidat: Kombinasi[] = [];

  // 1 meja
  for (const m of bebas) {
    if (m.kapasitas >= jumlahTamu) {
      kandidat.push({
        meja: [{ id: m.id, nomor: m.nomor, kapasitas: m.kapasitas }],
        totalKapasitas: m.kapasitas,
        sisaKapasitas: m.kapasitas - jumlahTamu,
        gabungan: false,
      });
    }
  }

  // gabungan 2-3 meja yang saling terhubung (satu komponen)
  const terhubung = (ids: number[]): boolean => {
    const set = new Set(ids);
    const stack = [ids[0]];
    const seen = new Set([ids[0]]);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const t of byId.get(cur)!.tetangga) {
        if (set.has(t) && !seen.has(t)) {
          seen.add(t);
          stack.push(t);
        }
      }
    }
    return seen.size === ids.length;
  };

  for (let size = 2; size <= 3; size++) {
    const combo = (start: number, picked: Node[]) => {
      if (picked.length === size) {
        const ids = picked.map((p) => p.id);
        if (!terhubung(ids)) return;
        const total = picked.reduce((s, p) => s + p.kapasitas, 0);
        if (total >= jumlahTamu) {
          kandidat.push({
            meja: picked.map((p) => ({ id: p.id, nomor: p.nomor, kapasitas: p.kapasitas })),
            totalKapasitas: total,
            sisaKapasitas: total - jumlahTamu,
            gabungan: true,
          });
        }
        return;
      }
      for (let i = start; i < bebas.length; i++) {
        picked.push(bebas[i]);
        combo(i + 1, picked);
        picked.pop();
      }
    };
    combo(0, []);
  }

  kandidat.sort(
    (a, b) =>
      a.sisaKapasitas - b.sisaKapasitas ||
      a.meja.length - b.meja.length ||
      a.totalKapasitas - b.totalKapasitas
  );
  const unik = new Map<string, Kombinasi>();
  for (const k of kandidat) {
    const key = k.meja.map((m) => m.id).sort((x, y) => x - y).join(",");
    if (!unik.has(key)) unik.set(key, k);
  }
  const semua = [...unik.values()];
  return { dipilih: semua[0] ?? null, alternatif: semua.slice(1, 4) };
}

/** Status tiap meja pada tanggal+jam: tersedia | dipesan | diduduki | digabung. */
export async function statusMeja(
  tanggal: string,
  jam: string
): Promise<(MejaInfo & { status: string; reservasiId: number | null })[]> {
  const mejas = await prisma.meja.findMany({ where: { aktif: true }, orderBy: { id: "asc" } });
  const pakai = await prisma.reservasiMeja.findMany({
    where: {
      reservasi: {
        tanggal,
        status: { in: STATUS_AKTIF },
        jamMulai: { lte: jam },
        jamSelesai: { gt: jam },
      },
    },
    include: { reservasi: { include: { meja: true } } },
  });
  const perMeja = new Map<number, { status: string; reservasiId: number }>();
  for (const rm of pakai) {
    if (perMeja.has(rm.mejaId)) continue;
    const r = rm.reservasi;
    const status = r.meja.length > 1 ? "digabung" : r.status === "diduduki" ? "diduduki" : "dipesan";
    perMeja.set(rm.mejaId, { status, reservasiId: r.id });
  }
  return mejas.map((m) => ({
    id: m.id,
    nomor: m.nomor,
    kapasitas: m.kapasitas,
    status: perMeja.get(m.id)?.status ?? "tersedia",
    reservasiId: perMeja.get(m.id)?.reservasiId ?? null,
  }));
}
