import { Plus_Jakarta_Sans, Bricolage_Grotesque, Geist_Mono } from "next/font/google"
import "./globals.css"
import SessionWrapper from "@/components/SessionWrapper"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

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
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="shortcut icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        data-density="comfortable"
        data-sb="expanded"
        className={`${jakarta.variable} ${bricolage.variable} ${geistMono.variable} min-h-full flex flex-col`}
      >
        <SessionWrapper>
          <ServiceWorkerRegister />
          {children}
        </SessionWrapper>
      </body>
    </html>
  )
}
