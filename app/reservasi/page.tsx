"use client";
import { useState } from "react";

type Kombinasi = {
  meja: { id: number; nomor: string; kapasitas: number }[];
  totalKapasitas: number;
  sisaKapasitas: number;
  gabungan: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export default function FormReservasi() {
  const [tanggal, setTanggal] = useState(todayStr());
  const [jamMulai, setJamMulai] = useState("19:00");
  const [jamSelesai, setJamSelesai] = useState("21:00");
  const [namaTamu, setNamaTamu] = useState("");
  const [jumlahTamu, setJumlahTamu] = useState(2);
  const [kontak, setKontak] = useState("");
  const [dipilih, setDipilih] = useState<Kombinasi | null>(null);
  const [alternatif, setAlternatif] = useState<Kombinasi[]>([]);
  const [pilihanIdx, setPilihanIdx] = useState(0);
  const [pesan, setPesan] = useState("");
  const [mencari, setMencari] = useState(false);

  const semuaKombinasi = [...(dipilih ? [dipilih] : []), ...alternatif];

  const cariMeja = async () => {
    setPesan("");
    setMencari(true);
    try {
      const q = new URLSearchParams({ tanggal, jamMulai, jamSelesai, jumlahTamu: String(jumlahTamu) });
      const res = await fetch(`/api/kombinasi?${q}`);
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.error ?? "Gagal mencari meja");
        setDipilih(null);
        setAlternatif([]);
        return;
      }
      setDipilih(data.dipilih);
      setAlternatif(data.alternatif ?? []);
      setPilihanIdx(0);
      if (!data.dipilih) setPesan("Tidak ada kombinasi meja yang tersedia untuk slot ini.");
    } finally {
      setMencari(false);
    }
  };

  const simpan = async () => {
    const combo = semuaKombinasi[pilihanIdx];
    if (!combo) return;
    setPesan("Menyimpan...");
    const res = await fetch("/api/reservasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tanggal, jamMulai, jamSelesai, namaTamu, jumlahTamu, kontak,
        mejaIds: combo.meja.map((m) => m.id),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPesan(`Gagal (${res.status}): ${data.error ?? "unknown"}`);
      return;
    }
    setPesan(`Reservasi tersimpan! Meja: ${data.meja.map((m: { nomor: string }) => m.nomor).join(" + ")}`);
  };

  const inputCls = "w-full rounded border px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservasi Baru</h1>
          <p className="text-sm text-slate-500">Sistem mencarikan kombinasi meja terbaik otomatis</p>
        </div>
        <a href="/" className="text-sm text-slate-600 underline">← Dashboard</a>
      </header>

      <section className="mb-4 rounded border bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Tanggal<input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputCls} /></label>
          <label className="text-sm">Jumlah tamu<input type="number" min={1} value={jumlahTamu} onChange={(e) => setJumlahTamu(Number(e.target.value))} className={inputCls} /></label>
          <label className="text-sm">Jam mulai<input type="time" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} className={inputCls} /></label>
          <label className="text-sm">Jam selesai<input type="time" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} className={inputCls} /></label>
          <label className="text-sm">Nama tamu<input value={namaTamu} onChange={(e) => setNamaTamu(e.target.value)} placeholder="Nama pemesan" className={inputCls} /></label>
          <label className="text-sm">Kontak<input value={kontak} onChange={(e) => setKontak(e.target.value)} placeholder="No. HP (opsional)" className={inputCls} /></label>
        </div>
        <button onClick={cariMeja} disabled={mencari}
          className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {mencari ? "Mencari..." : "Cari Kombinasi Meja"}
        </button>
      </section>

      {semuaKombinasi.length > 0 && (
        <section className="mb-4 rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Usulan Kombinasi Meja</h2>
          <div className="space-y-2">
            {semuaKombinasi.map((k, i) => (
              <label key={i} className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${pilihanIdx === i ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                <input type="radio" checked={pilihanIdx === i} onChange={() => setPilihanIdx(i)} />
                <div className="text-sm">
                  <span className="font-bold">{k.meja.map((m) => m.nomor).join(" + ")}</span>
                  <span className="ml-2 text-slate-500">
                    kapasitas {k.totalKapasitas} · sisa {k.sisaKapasitas} kursi
                    {k.gabungan ? " · gabungan" : ""}
                  </span>
                  {i === 0 && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Terbaik</span>}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-slate-500">Nama tamu wajib diisi sebelum menyimpan</label>
            <button onClick={simpan} disabled={!namaTamu.trim()}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              Simpan Reservasi
            </button>
          </div>
        </section>
      )}

      {pesan && <p className="rounded border bg-white p-3 text-sm">{pesan}</p>}
    </main>
  );
}
