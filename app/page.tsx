"use client";
import { useCallback, useEffect, useState } from "react";

type MejaStatus = { id: number; nomor: string; kapasitas: number; status: string; reservasiId: number | null };
type Reservasi = {
  id: number; tanggal: string; jamMulai: string; jamSelesai: string;
  namaTamu: string; jumlahTamu: number; status: string;
  meja: { id: number; nomor: string; kapasitas: number }[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowStr = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const WARNA: Record<string, string> = {
  tersedia: "bg-emerald-100 border-emerald-400 text-emerald-800",
  dipesan: "bg-amber-100 border-amber-400 text-amber-800",
  diduduki: "bg-red-100 border-red-400 text-red-800",
  digabung: "bg-violet-100 border-violet-400 text-violet-800",
};
const LABEL: Record<string, string> = {
  tersedia: "Tersedia", dipesan: "Dipesan", diduduki: "Diduduki", digabung: "Digabung",
};

export default function Dashboard() {
  const [tanggal, setTanggal] = useState(todayStr());
  const [jam, setJam] = useState(nowStr());
  const [meja, setMeja] = useState<MejaStatus[]>([]);
  const [reservasi, setReservasi] = useState<Reservasi[]>([]);
  const [sweepMsg, setSweepMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetch(`/api/meja/status?tanggal=${tanggal}&jam=${jam}`).then((x) => x.json()),
        fetch(`/api/reservasi?tanggal=${tanggal}`).then((x) => x.json()),
      ]);
      setMeja(s.meja ?? []);
      setReservasi(r ?? []);
    } finally {
      setLoading(false);
    }
  }, [tanggal, jam]);

  useEffect(() => { muat(); }, [muat]);

  const jalankanSweep = async () => {
    setSweepMsg("Menjalankan sweep...");
    const res = await fetch("/api/sweep", { method: "POST" }).then((x) => x.json());
    setSweepMsg(
      res.dibatalkan > 0
        ? `Sweep selesai: ${res.dibatalkan} reservasi dibatalkan (meja dilepas).`
        : "Sweep selesai: tidak ada reservasi kedaluwarsa."
    );
    muat();
  };

  const aksi = async (id: number, path: "checkin" | "batal") => {
    const res = await fetch(`/api/reservasi/${id}/${path}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error ?? "Gagal");
    muat();
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reservasi Meja Restoran</h1>
          <p className="text-sm text-slate-500">Denah meja, reservasi, check-in & auto-release</p>
        </div>
        <a href="/reservasi" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          + Reservasi Baru
        </a>
      </header>

      <section className="mb-6 rounded border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Tanggal
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
              className="ml-2 rounded border px-2 py-1" />
          </label>
          <label className="text-sm">Jam
            <input type="time" value={jam} onChange={(e) => setJam(e.target.value)}
              className="ml-2 rounded border px-2 py-1" />
          </label>
          <button onClick={muat} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            {loading ? "Memuat..." : "Muat Ulang"}
          </button>
          <button onClick={jalankanSweep} className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500">
            Jalankan Sweep
          </button>
          {sweepMsg && <span className="text-sm text-slate-600">{sweepMsg}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {Object.keys(WARNA).map((k) => (
            <span key={k} className={`rounded border px-2 py-0.5 ${WARNA[k]}`}>{LABEL[k]}</span>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded border bg-white p-4">
        <h2 className="mb-3 font-semibold">Denah Meja — {tanggal} pukul {jam}</h2>
        <div className="grid grid-cols-3 gap-4">
          {meja.map((m) => (
            <div key={m.id} className={`rounded-lg border-2 p-4 text-center ${WARNA[m.status] ?? WARNA.tersedia}`}>
              <div className="text-xl font-bold">{m.nomor}</div>
              <div className="text-sm">Kapasitas {m.kapasitas} orang</div>
              <div className="mt-1 text-xs font-semibold uppercase">{LABEL[m.status] ?? m.status}</div>
            </div>
          ))}
          {meja.length === 0 && <p className="text-sm text-slate-500">Belum ada data meja.</p>}
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 font-semibold">Daftar Reservasi — {tanggal}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-3">Jam</th>
                <th className="py-2 pr-3">Tamu</th>
                <th className="py-2 pr-3">Jml</th>
                <th className="py-2 pr-3">Meja</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reservasi.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{r.jamMulai}–{r.jamSelesai}</td>
                  <td className="py-2 pr-3 font-medium">{r.namaTamu}</td>
                  <td className="py-2 pr-3">{r.jumlahTamu}</td>
                  <td className="py-2 pr-3">{r.meja.map((m) => m.nomor).join(" + ")}</td>
                  <td className="py-2 pr-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{r.status}</span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {r.status === "dipesan" && (
                        <button onClick={() => aksi(r.id, "checkin")}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500">Check-in</button>
                      )}
                      {(r.status === "dipesan" || r.status === "diduduki") && (
                        <button onClick={() => aksi(r.id, "batal")}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500">Batal</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {reservasi.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-slate-500">Belum ada reservasi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
