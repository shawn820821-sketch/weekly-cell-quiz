import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "주간 셀 퀴즈", description: "GOD'S WORD, OUR DAILY LIFE" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><div className="ambient ambientA" /><div className="ambient ambientB" />{children}</body></html>;
}
