import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeReservasi } from "@/lib/reservasi";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const r = await prisma.reservasi.findUnique({
    where: { id },
    include: { meja: { include: { meja: true } } },
  });
  if (!r) return NextResponse.json({ error: "reservasi tidak ditemukan" }, { status: 404 });
  if (r.status === "dibatalkan" || r.status === "selesai")
    return NextResponse.json({ error: `reservasi sudah "${r.status}"` }, { status: 409 });
  const updated = await prisma.reservasi.update({
    where: { id },
    data: { status: "dibatalkan" },
    include: { meja: { include: { meja: true } } },
  });
  return NextResponse.json(serializeReservasi(updated));
}
