import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';
  const apiBase = env.VITE_API_BASE || '/gold-price-alert/api';
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || '';

  const proxy = apiProxyTarget
    ? {
        [apiBase]: {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      }
    : undefined;

  return {
    base,
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 5000,
      proxy,
    },
  };
});
