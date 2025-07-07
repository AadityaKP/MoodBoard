import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/callback': 'http://127.0.0.1:8888',
      '/login': 'http://127.0.0.1:8888',
      '/current': 'http://127.0.0.1:8888',
      '/control': 'http://127.0.0.1:8888',
      '/user-mood': 'http://127.0.0.1:8888',
      '/mood-distribution': 'http://127.0.0.1:8888',
      '/suggestions': 'http://127.0.0.1:8888',
      '/top-songs': 'http://127.0.0.1:8888',
      '/weekly-trends': 'http://127.0.0.1:8888',
      '/reflections': 'http://127.0.0.1:8888',
      '/trends': 'http://127.0.0.1:8888',
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
