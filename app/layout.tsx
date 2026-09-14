import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "MiraTech Business Suite",
  description: "Enterprise-grade business operations platform featuring modular architecture, role-based access control, automated payroll workflows, real-time analytics, dynamic department routing, and complete lifecycle governance.",
  openGraph: {
    title: "MiraTech Business Suite",
    description: "Enterprise-grade business operations platform featuring modular architecture, role-based access control, automated payroll workflows, real-time analytics, dynamic department routing, and complete lifecycle governance.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
