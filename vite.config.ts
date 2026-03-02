import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";


export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
      output: {
        // 深度拆分供应商库
        manualChunks(id) {
          if (id.includes('node_modules')) {
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
