import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      legacy({
        targets: [
          'chrome >= 52',
          'chromeAndroid >= 52',
          'safari >= 11',
          'iOS >= 11',
        ],
      }),
      tailwindcss(),
    ],
    build: {
      cssTarget: 'chrome88',
      terserOptions: {
        maxWorkers: 1,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }

            if (id.includes('motion') || id.includes('lucide-react')) {
              return 'ui-vendor';
            }

            if (id.includes('@google/genai')) {
              return 'ai-vendor';
            }

            return undefined;
          },
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      watch: {
        ignored: ['**/.codex-wechat-bridge.json'],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
