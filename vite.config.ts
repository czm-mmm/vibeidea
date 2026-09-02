/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // 相对路径：同时兼容本地根路径、花生壳根路径与 GitHub Pages 子路径（/vibeidea/）
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SCOUT · 马戏团单机版',
        short_name: 'SCOUT',
        description: 'SCOUT 单机版：玩家 vs AI，纯前端离线运行',
        lang: 'zh-CN',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#0f2622',
        theme_color: '#173a35',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 允许通过内网穿透域名访问（vicp.fun 为花生壳动态域名的后缀）
  server: {
    allowedHosts: ['.vicp.fun'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.vicp.fun'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
