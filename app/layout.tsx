import './globals.css';
import { Inter } from 'next/font/google';
import { cn } from "@/lib/utils";
import { FirebaseProvider } from '@/components/FirebaseProvider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: 'Mira Business Suite',
  description: 'Enterprise-grade multi-tenant Business Management SaaS platform.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans antialiased", inter.variable)}>
      <body suppressHydrationWarning>
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
