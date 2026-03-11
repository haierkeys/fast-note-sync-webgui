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
    // 处理开发环境下的路径重写，使 /share.html/id/token 能够加载 share.html
    proxy: {
       '^/share.html/.*': {
          target: 'http://localhost:5173',
          rewrite: () => '/share.html',
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
    chunkSizeWarningLimit: 1500, // 降低警告阈值到 1MB
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        share: path.resolve(__dirname, 'share.html'),
      },
      output: {
        // 深度拆分供应商库
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 核心 React 库
            if (id.includes('react') && (id.includes('react-dom') || id.includes('scheduler'))) {
              return 'vendor-react-core';
            }
            // Markdown 相关库（体积通常很大）
            if (id.includes('react-markdown') || id.includes('rehype') || id.includes('remark') || id.includes('micromark')) {
              return 'vendor-markdown';
            }
            // 每一个分类拆分为独立文件，减小单个包体积
            if (id.includes('lucide') || id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('motion') || id.includes('framer-motion')) {
              return 'vendor-animation';
            }
            if (id.includes('codemirror') || id.includes('@uiw/react-codemirror')) {
              return 'vendor-editor-cm';
            }
            if (id.includes('dnd-kit')) {
              return 'vendor-dnd';
            }
            if (id.includes('@radix-ui') || id.includes('@headlessui')) {
              return 'vendor-ui';
            }
            if (id.includes('lottiefiles')) {
              return 'vendor-lottie';
            }
            if (id.includes('date-fns') || id.includes('zod') || id.includes('zustand') || id.includes('diff-match-patch')) {
              return 'vendor-utils';
            }
            // 其余通用库依然放在 vendor，确保 React 等核心库顺序
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
