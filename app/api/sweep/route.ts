import { NextRequest, NextResponse } from "next/server";
import { sweepAutoRelease } from "@/lib/reservasi";

/**
 * POST /api/sweep — batalkan reservasi "dipesan" yang tamunya tidak check-in
 * dalam batas toleransi (default 15 menit setelah jam mulai).
 * Body opsional: { toleransiMenit: number }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  let toleransi = 15;
  if (body && body.toleransiMenit !== undefined) {
    const t = Number(body.toleransiMenit);
    if (!Number.isInteger(t) || t < 0)
      return NextResponse.json({ error: "toleransiMenit harus bilangan bulat >= 0" }, { status: 400 });
    toleransi = t;
  }
  const hasil = await sweepAutoRelease(toleransi);
  return NextResponse.json({ toleransiMenit: toleransi, ...hasil });
}
