import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync, mkdirSync } from "fs";

const buildId = process.env.BUILD_ID ?? Date.now().toString();

function writeVersionJson(): Plugin {
  return {
    name: "lyto-write-version-json",
    apply: "build",
    closeBundle() {
      try {
        const outDir = path.resolve(__dirname, "dist");
        mkdirSync(outDir, { recursive: true });
        writeFileSync(
          path.join(outDir, "version.json"),
          JSON.stringify({ version: buildId }) + "\n",
          "utf8",
        );
      } catch (err) {
        console.error("[writeVersionJson] failed:", err);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  // Drop console.log/info/debug/warn (preserva console.error) apenas em build de produção
  esbuild:
    mode === 'production'
      ? { drop: ['debugger'], pure: ['console.log', 'console.info', 'console.debug', 'console.warn'] }
      : undefined,
  plugins: [react(), writeVersionJson()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    sourcemap: false,
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
          'lucide': ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },
}));
