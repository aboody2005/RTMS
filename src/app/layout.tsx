import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام إدارة فرق تجارب الأرانب",
  description: "نظام متكامل لإدارة طلاب الصيدلة في التجارب العملية على الأرانب - تنظيم المجموعات والفرق وتوزيع الطلاب",
  keywords: "إدارة فرق, طلاب صيدلة, تجارب الأرانب, جامعة",
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/icon.jpg', type: 'image/jpeg' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rabbit_theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
