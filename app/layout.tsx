import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import InstallClientWrapper from "../components/InstallClientWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MiraTech Executive Report & Ledger Engine",
  description: "Enterprise quotations, invoices, receipts, and Google Sheets/Drive active sync dashboard with letterhead exporting.",
  appleWebApp: {
    title: "MiraTech",
    statusBarStyle: "default",
    capable: true,
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  }
};

export const viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
        <InstallClientWrapper />
      </body>
    </html>
  );
}
