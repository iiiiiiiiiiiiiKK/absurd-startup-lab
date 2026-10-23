import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相对路径，方便部署到任意子目录 / 静态托管 / Cloudflare Pages
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    proxy:
      command === 'serve'
        ? {
            // 仅开发模式：把 /api 代理到可选的 AI 本地服务端（server/ai-dev-server.mjs）
            '/api': {
              target: 'http://127.0.0.1:5199',
              changeOrigin: true,
            },
          }
        : undefined,
  },
  preview: {
    host: '127.0.0.1',
    port: 4285,
    // 预览 / 生产一律走真实静态文件或 Pages Functions，不做代理转发
    proxy: {},
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
}));
