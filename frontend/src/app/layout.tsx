'use client';

import type { Metadata } from 'next';
import './globals.css';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showNotifications = pathname !== '/' && pathname !== '/login' && pathname !== '/register';

  return (
    <html lang="en">
      <body>
        {children}
        {showNotifications && <NotificationCenter />}
      </body>
    </html>
  );
}
