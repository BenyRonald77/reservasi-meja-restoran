import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const a = Number(body?.mejaAId);
  const b = Number(body?.mejaBId);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a === b)
    return NextResponse.json({ error: "mejaAId dan mejaBId harus dua id meja berbeda" }, { status: 400 });
  const count = await prisma.meja.count({ where: { id: { in: [a, b] }, aktif: true } });
  if (count !== 2)
    return NextResponse.json({ error: "salah satu meja tidak dikenal / tidak aktif" }, { status: 404 });
  const [x, y] = [a, b].sort((p, q) => p - q);
  try {
    const created = await prisma.adjacency.create({ data: { mejaAId: x, mejaBId: y } });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "relasi adjacency sudah ada" }, { status: 409 });
  }
}
