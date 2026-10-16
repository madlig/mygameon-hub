/**
 * lib/changelog.js
 * 
 * Master data riwayat pembaruan (Changelog & Release Notes) MyGameON Studio Hub.
 * Digunakan oleh ChangelogModal di UI dan script auto-publish GitHub release.
 */

export const CHANGELOG_HISTORY = [
  {
    version: '1.2.5',
    date: '16 Oktober 2026',
    title: 'Listing Studio Non-Steam Support & Multi-CDN Image Engine',
    highlights: [
      {
        type: 'feature',
        tag: 'Fitur Baru',
        text: 'Dukungan Game Non-Steam & Emulator (RAWG Database): Listing Studio kini otomatis mendeteksi game porting konsol / emulator (seperti God of War 3 Remastered) dan menarik 4 screenshot gameplay Full HD resmi.'
      },
      {
        type: 'feature',
        tag: 'Fitur Baru',
        text: 'Mode Buat Listing Manual: Kotak pencarian menyediakan tombol instan untuk membuat 6 slide produk secara manual jika game custom tidak ada di database mana pun.'
      },
      {
        type: 'feature',
        tag: 'Fitur Baru',
        text: 'Upload File & Paste Clipboard (Ctrl+V): Cover dan 4 screenshot gameplay kini bisa langsung diunggah dari file harddisk atau ditempel langsung via Ctrl+V (Salin Gambar).'
      },
      {
        type: 'improvement',
        tag: 'Peningkatan',
        text: 'Multi-CDN Fallback Server: Menguji ketersediaan poster 600x900 secara paralel di server Akamai, Cloudflare, dan Fastly. Jika game baru belum memiliki poster vertikal, sistem memberi status jelas tanpa memaksakan screenshot.'
      },
      {
        type: 'improvement',
        tag: 'Peningkatan',
        text: 'Integrasi Browser Native: Tombol "Cari di Google Images" kini langsung membuka browser bawaan komputer (Chrome / Edge) agar menu klik kanan "Salin alamat gambar" berfungsi normal.'
      },
      {
        type: 'feature',
        tag: 'Fitur Baru',
        text: 'In-App Release Notes: Ditambahkan dialog riwayat pembaruan sistem yang dapat dibuka kapan saja dengan mengklik versi aplikasi di sidebar.'
      }
    ]
  },
  {
    version: '1.2.4',
    date: '15 Oktober 2026',
    title: 'Download Hub Chrome Catcher & Pipeline Watcher',
    highlights: [
      {
        type: 'feature',
        tag: 'Fitur Baru',
        text: 'Ekstensi browser Chrome / Edge untuk menangkap link download game otomatis (CNL & Direct Link).'
      },
      {
        type: 'improvement',
        tag: 'Peningkatan',
        text: 'Peningkatan auto-extractor multi-part RAR dengan deteksi password cerdas.'
      },
      {
        type: 'fix',
        tag: 'Perbaikan',
        text: 'Perbaikan sinkronisasi status Google Drive staging folder di Workbench.'
      }
    ]
  },
  {
    version: '1.2.3',
    date: '14 Oktober 2026',
    title: 'Workbench Archive Status Sync & CRM Improvements',
    highlights: [
      {
        type: 'improvement',
        tag: 'Peningkatan',
        text: 'Sinkronisasi status arsip game otomatis di Workbench.'
      },
      {
        type: 'fix',
        tag: 'Perbaikan',
        text: 'Perbaikan validasi lisensi Sims 4 dan integrasi pengiriman email pelanggan.'
      }
    ]
  },
  {
    version: '1.2.0',
    date: '12 Oktober 2026',
    title: 'Major Release: Workbench, Download Hub & Mobile Access',
    highlights: [
      {
        type: 'feature',
        tag: 'Fitur Besar',
        text: 'Peluncuran modul Workbench, Download Hub, Cloudflare Tunnel remote control, dan File Manager multi-workspace.'
      }
    ]
  }
];

export function getLatestReleaseNotes() {
  const latest = CHANGELOG_HISTORY[0];
  if (!latest) return '';
  return `### MyGameON Studio v${latest.version} (${latest.date})\n**${latest.title}**\n\n` +
    latest.highlights.map(h => `- **[${h.tag}]** ${h.text}`).join('\n');
}
