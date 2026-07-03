import { compression } from 'vite-plugin-compression2';
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";


export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithms: ['gzip'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    compression({
      algorithms: ['brotliCompress'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    cors: true,
    // 处理开发环境下的路径重写，使 /share.html/id/token 或 /share/id/token 能够加载 share.html
    proxy: {
      '^/(share.html|share)/.*': {
        target: 'http://localhost:5173',
        rewrite: () => '/share.html',
      },
      '/api/user/sync': {
        target: 'ws://localhost:9000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      }
    }
  },
  build: {
    minify: 'terser', // 使用 Terser 压缩
    terserOptions: {
      compress: {
        drop_console: true,  // 去除 console.log
      },
    },
    chunkSizeWarningLimit: 2048, // 降低警告阈值到 1MB
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        share: path.resolve(__dirname, 'share.html'),
        oauthAuthorize: path.resolve(__dirname, 'oauth-authorize.html'),
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
