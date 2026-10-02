import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeReservasi } from "@/lib/reservasi";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const r = await prisma.reservasi.findUnique({
    where: { id },
    include: { meja: { include: { meja: true } } },
  });
  if (!r) return NextResponse.json({ error: "reservasi tidak ditemukan" }, { status: 404 });
  return NextResponse.json(serializeReservasi(r));
}
