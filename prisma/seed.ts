import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const n = await prisma.meja.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }

  // Denah grid 3x3 (8 meja): (kolom, baris)
  const mejaData: { nomor: string; kapasitas: number; posX: number; posY: number }[] = [
    { nomor: "M1", kapasitas: 2, posX: 0, posY: 0 },
    { nomor: "M2", kapasitas: 2, posX: 1, posY: 0 },
    { nomor: "M3", kapasitas: 4, posX: 2, posY: 0 },
    { nomor: "M4", kapasitas: 4, posX: 0, posY: 1 },
    { nomor: "M5", kapasitas: 6, posX: 1, posY: 1 },
    { nomor: "M6", kapasitas: 2, posX: 2, posY: 1 },
    { nomor: "M7", kapasitas: 8, posX: 0, posY: 2 },
    { nomor: "M8", kapasitas: 4, posX: 1, posY: 2 },
  ];
  const meja = await Promise.all(mejaData.map((m) => prisma.meja.create({ data: m })));
  const id = (nomor: string) => meja.find((m) => m.nomor === nomor)!.id;

  const pasangan: [string, string][] = [
    ["M1", "M2"], ["M2", "M3"],
    ["M4", "M5"], ["M5", "M6"],
    ["M7", "M8"],
    ["M1", "M4"], ["M2", "M5"], ["M3", "M6"],
    ["M4", "M7"], ["M5", "M8"],
  ];
  for (const [a, b] of pasangan) {
    const [x, y] = [id(a), id(b)].sort((p, q) => p - q);
    await prisma.adjacency.create({ data: { mejaAId: x, mejaBId: y } });
  }

  // Reservasi contoh hari ini (zona WIB, konsisten dengan lib/format.ts)
  const wib = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [y, m, dd] = wib.split("-");
  const tanggal = `${y}-${m}-${dd}`;
  const r1 = await prisma.reservasi.create({
    data: {
      tanggal, jamMulai: "19:00", jamSelesai: "21:00",
      namaTamu: "Keluarga Santoso", jumlahTamu: 5, kontak: "0812-0001",
      status: "dipesan", createdAt: new Date().toISOString(),
    },
  });
  await prisma.reservasiMeja.create({ data: { reservasiId: r1.id, mejaId: id("M5") } });

  const r2 = await prisma.reservasi.create({
    data: {
      tanggal, jamMulai: "18:00", jamSelesai: "20:00",
      namaTamu: "Rombongan Arisan", jumlahTamu: 10, kontak: "0812-0002",
      status: "diduduki", createdAt: new Date().toISOString(),
      checkedInAt: new Date().toISOString(),
    },
  });
  await prisma.reservasiMeja.createMany({
    data: [
      { reservasiId: r2.id, mejaId: id("M7") },
      { reservasiId: r2.id, mejaId: id("M8") },
    ],
  });

  console.log("seed selesai: 8 meja, 10 adjacency, 2 reservasi contoh");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
