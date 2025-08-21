import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  // StackBlitz（dev）では '/'、GitHub Pages ビルド時だけ '/is-ec-pj-bjn8jcr4/' に。
  base: process.env.BUILD_TARGET === 'pages' ? '/is-ec-pj-bjn8jcr4/' : '/',
  plugins: [vue()],
  optimizeDeps: {
    include: ['firebase/app', 'firebase/firestore'],
  },
})
