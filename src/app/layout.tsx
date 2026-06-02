import type { Metadata } from "next";
import { Playfair_Display, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const notoSansTc = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "電子報 7 天文案產生器",
  description: "根據品牌資料，自動產出信任信與銷售信文案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full">
      <body
        className={`${playfair.variable} ${notoSansTc.variable} h-full bg-[#f5f0e8] text-[#1a2e1a] antialiased`}
        style={{ fontFamily: "var(--font-noto-sans-tc), sans-serif" }}
      >
        <div className="mx-auto min-h-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
