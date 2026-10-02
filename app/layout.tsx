import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Reservasi Meja Restoran",
  description: "Reservasi meja restoran dengan penggabungan meja otomatis",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
