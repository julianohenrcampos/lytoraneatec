
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        sourcemap: false
      },
      includeAssets: ['favicon.ico', 'icons/maskable-icon1.png', 'icons/dcf6c980-f927-4180-b109-b425da1323ba.png'],
      manifest: {
        name: 'Lytorânea Construtora - Sistema ERP',
        short_name: 'LYTOTEC ERP',
        description: 'Sistema ERP completo para gestão de empresas de construção civil',
        theme_color: '#DD2C00',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        id: 'app.lytotec.erp',
        prefer_related_applications: false,
        categories: ['business', 'productivity'],
        icons: [
          { src: 'icons/maskable-icon1.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-icon1.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    sourcemap: mode === 'development',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-toast'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
          xlsx: ['xlsx'],
          'react-query': ['@tanstack/react-query'],
          'date-utils': ['date-fns', 'date-fns-tz'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'routing': ['react-router-dom'],
          'lucide': ['lucide-react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']
  }
}));
