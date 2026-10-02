import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.meja.findMany({
    orderBy: { id: "asc" },
    include: { adjacencyA: true, adjacencyB: true },
  });
  const data = rows.map((m) => ({
    id: m.id,
    nomor: m.nomor,
    kapasitas: m.kapasitas,
    posX: m.posX,
    posY: m.posY,
    aktif: m.aktif,
    tetangga: [
      ...m.adjacencyA.map((a) => a.mejaBId),
      ...m.adjacencyB.map((a) => a.mejaAId),
    ],
  }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { nomor, kapasitas, posX, posY } = body ?? {};
  if (!nomor || typeof nomor !== "string" || nomor.trim() === "")
    return NextResponse.json({ error: "nomor wajib diisi" }, { status: 400 });
  const kap = Number(kapasitas);
  if (!Number.isInteger(kap) || kap < 1)
    return NextResponse.json({ error: "kapasitas harus bilangan bulat >= 1" }, { status: 400 });
  try {
    const created = await prisma.meja.create({
      data: {
        nomor: nomor.trim(),
        kapasitas: kap,
        posX: Number.isInteger(Number(posX)) ? Number(posX) : 0,
        posY: Number.isInteger(Number(posY)) ? Number(posY) : 0,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "nomor meja sudah dipakai" }, { status: 409 });
  }
}
