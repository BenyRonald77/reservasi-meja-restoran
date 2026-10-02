import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buatReservasi, HttpError, ReservasiInput, serializeReservasi } from "@/lib/reservasi";
import { isValidDate, isValidTime } from "@/lib/format";

const includeMeja = { include: { meja: { include: { meja: true } } } };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const where: Record<string, string> = {};
  if (q.get("tanggal")) where.tanggal = q.get("tanggal")!;
  if (q.get("status")) where.status = q.get("status")!;
  const rows = await prisma.reservasi.findMany({
    where,
    orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
    ...includeMeja,
  });
  return NextResponse.json(rows.map(serializeReservasi));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const err = validasi(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const input: ReservasiInput = {
    tanggal: body.tanggal,
    jamMulai: body.jamMulai,
    jamSelesai: body.jamSelesai,
    namaTamu: String(body.namaTamu).trim(),
    jumlahTamu: Number(body.jumlahTamu),
    kontak: body.kontak ? String(body.kontak) : "",
    mejaIds: Array.isArray(body.mejaIds) ? body.mejaIds.map(Number).filter((n: number) => Number.isInteger(n)) : undefined,
  };
  try {
    const r = await buatReservasi(input);
    return NextResponse.json(serializeReservasi(r), { status: 201 });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

function validasi(body: Record<string, unknown> | null): string | null {
  if (!body) return "body JSON tidak valid";
  if (!isValidDate(String(body.tanggal ?? ""))) return "tanggal harus format YYYY-MM-DD";
  if (!isValidTime(String(body.jamMulai ?? "")) || !isValidTime(String(body.jamSelesai ?? "")))
    return "jamMulai/jamSelesai harus format HH:MM";
  if (String(body.jamSelesai) <= String(body.jamMulai)) return "jamSelesai harus lebih besar dari jamMulai";
  if (!body.namaTamu || String(body.namaTamu).trim() === "") return "namaTamu wajib diisi";
  const jml = Number(body.jumlahTamu);
  if (!Number.isInteger(jml) || jml < 1) return "jumlahTamu harus bilangan bulat >= 1";
  return null;
}
