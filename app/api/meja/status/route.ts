import { NextRequest, NextResponse } from "next/server";
import { statusMeja } from "@/lib/kombinasi";
import { isValidDate, isValidTime } from "@/lib/format";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tanggal = q.get("tanggal") ?? "";
  const jam = q.get("jam") ?? "";
  if (!isValidDate(tanggal) || !isValidTime(jam))
    return NextResponse.json({ error: "parameter tanggal (YYYY-MM-DD) dan jam (HH:MM) wajib valid" }, { status: 400 });
  const data = await statusMeja(tanggal, jam);
  return NextResponse.json({ tanggal, jam, meja: data });
}
