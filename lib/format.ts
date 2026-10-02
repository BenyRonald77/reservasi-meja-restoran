export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
