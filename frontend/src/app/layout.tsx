'use client';

import type { Metadata } from 'next';
import './globals.css';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

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
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1F2937',
              color: '#F3F4F6',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#F3F4F6',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#F3F4F6',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
