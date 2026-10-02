// Zona waktu operasional restoran (WIB). Server VM berjalan di UTC,
// jadi tanggal/jam "hari ini" dihitung dalam Asia/Jakarta agar sweep
// dan filter tanggal sesuai jam operasional pengguna.
const TZ = "Asia/Jakarta";
const parts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), min: g("minute") };
};
export const today = () => {
  const p = parts(new Date());
  return `${p.y}-${p.m}-${p.d}`;
};
export const nowTime = () => {
  const p = parts(new Date());
  const h = p.h === "24" ? "00" : p.h;
  return `${h}:${p.min}`;
};
/** Kurangi menit dari "HH:MM", hasil "HH:MM" (boleh negatif jam -> clamp 00:00). */
export const minusMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m - mins;
  if (total < 0) total = 0;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
