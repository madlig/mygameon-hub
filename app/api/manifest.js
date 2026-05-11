export default function manifest() {
  return {
    name: 'MyGameON Hub',
    short_name: 'MyGameON',
    description: 'Admin panel MyGameON — kelola pengiriman game',
    start_url: '/',
    display: 'standalone',
    background_color: '#1C1917',
    theme_color: '#1C1917',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}