import type { Metadata } from "next";
import "./globals.css";

const title = "주간 셀 퀴즈";
const description = "우리 셀과 함께하는 주간 성경 퀴즈! 지난주 말씀을 복습하고, 퀴즈를 풀고, 매주 순위를 확인해요.";
const siteUrl = "https://weekly-cell-quiz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  applicationName: title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: title,
    title,
    description,
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "주간 셀 퀴즈 - 매주 말씀을 함께 복습해요"
    }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  icons: { icon: "/icon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><div className="ambient ambientA" /><div className="ambient ambientB" />{children}</body></html>;
}
