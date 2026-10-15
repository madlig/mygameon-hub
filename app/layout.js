/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css"
import SessionWrapper from "@/components/SessionWrapper"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"

export const metadata = {
  title: 'MyGameON Hub',
  description: 'Admin panel MyGameON — kelola pengiriman game',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyGameON Hub',
  },
}

export const viewport = {
  themeColor: '#0a0b0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="shortcut icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        suppressHydrationWarning
        data-density="comfortable"
        data-sb="expanded"
        className="min-h-full flex flex-col font-sans antialiased text-[var(--text)] selection:bg-[var(--primary)] selection:text-black"
      >
        <SessionWrapper>
          <ServiceWorkerRegister />
          {children}
        </SessionWrapper>
      </body>
    </html>
  )
}
