import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MiraTech Business Manager',
    short_name: 'MiraTech',
    description: 'A comprehensive business management application',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
