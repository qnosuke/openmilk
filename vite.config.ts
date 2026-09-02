import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // オフライン起動のため静的アセットを Service Worker で precache する
      registerType: 'autoUpdate',
      manifest: {
        name: 'openmilk',
        short_name: 'openmilk',
        description: 'ブラウザで完結するタスク管理',
        lang: 'ja',
        display: 'standalone',
        start_url: '/',
        theme_color: '#f5f6f8',
        background_color: '#f5f6f8',
        icons: [
          {
            src: '/icons/milk-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/milk-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
