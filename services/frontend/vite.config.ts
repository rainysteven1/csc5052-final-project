import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const fallbackPollingEnabled =
  (process.env.VITE_USE_POLLING || 'true').toLowerCase() !== 'false';
const fallbackPollingInterval = Number.parseInt(
  process.env.VITE_POLLING_INTERVAL || '1000',
  10
);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pollingEnabled =
    (env.VITE_USE_POLLING || `${fallbackPollingEnabled}`).toLowerCase() !==
    'false';
  const pollingInterval = Number.parseInt(
    env.VITE_POLLING_INTERVAL || `${fallbackPollingInterval}`,
    10
  );

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: env.VITE_HOST || '0.0.0.0',
      port: Number(env.VITE_PORT) || 5173,
      watch: {
        // Keep polling enabled by default so dev mode stays stable on low-watch systems.
        usePolling: pollingEnabled,
        interval: Number.isFinite(pollingInterval) ? pollingInterval : 1000,
        ignored: ['**/.git/**', '**/dist/**', '**/coverage/**', '**/.cache/**'],
      },
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
