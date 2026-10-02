import { NextRequest, NextResponse } from "next/server";
import { cariKombinasi } from "@/lib/kombinasi";
import { isValidDate, isValidTime } from "@/lib/format";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tanggal = q.get("tanggal") ?? "";
  const jamMulai = q.get("jamMulai") ?? "";
  const jamSelesai = q.get("jamSelesai") ?? "";
  const jumlahTamu = Number(q.get("jumlahTamu"));
  if (!isValidDate(tanggal) || !isValidTime(jamMulai) || !isValidTime(jamSelesai))
    return NextResponse.json({ error: "format tanggal (YYYY-MM-DD) atau jam (HH:MM) tidak valid" }, { status: 400 });
  if (jamSelesai <= jamMulai)
    return NextResponse.json({ error: "jamSelesai harus lebih besar dari jamMulai" }, { status: 400 });
  if (!Number.isInteger(jumlahTamu) || jumlahTamu < 1)
    return NextResponse.json({ error: "jumlahTamu harus bilangan bulat >= 1" }, { status: 400 });
  const hasil = await cariKombinasi(tanggal, jamMulai, jamSelesai, jumlahTamu);
  return NextResponse.json({ ...hasil, jumlahTamu, tanggal, jamMulai, jamSelesai });
}
