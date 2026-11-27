import localFont from "next/font/local";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { indexableSite, siteOrigin } from "./site-metadata";

const vazirmatn = localFont({
  src: "../../node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-vazirmatn",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Tahoma", "Arial"],
});

const title = "وقتیمو | مدیریت و رزرو نوبت";
const description = "رزرو جلسات، برنامه‌ریزی و مدیریت مجموعه‌های ورزشی در یک محیط یکپارچه.";
const metadataBase = siteOrigin;

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  robots: { index: indexableSite, follow: true },
  applicationName: "وقتیمو",
  icons: { icon: "/assets/vaghtimo-mark.webp" },
  alternates: metadataBase ? { canonical: "/" } : undefined,
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "وقتیمو",
    title,
    description,
    ...(metadataBase && {
      url: "/",
      images: [{
        url: "/assets/social-card.webp",
        width: 1200,
        height: 630,
        alt: "تصویر تقویم و دمبل وقتیمو",
      }],
    }),
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body id="top">{children}</body>
    </html>
  );
}
