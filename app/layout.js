import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import SessionWrapper from "@/components/SessionWrapper"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata = {
  title: 'MyGameON Hub',
  description: 'Admin panel MyGameON',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyGameON Hub',
  },
}

export const viewport = {
  themeColor: '#1C1917',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        data-density="comfortable"
        data-sb="expanded"
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col`}
      >
        <SessionWrapper>
          <ServiceWorkerRegister />
          {children}
        </SessionWrapper>
      </body>
    </html>
  )
}
