import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue() as any],
  test: {
    coverage: {
      provider: 'v8',
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000, // 10 秒超时
    hookTimeout: 10000, // 10 秒钩子超时
    teardownTimeout: 10000, // 10 秒清理超时
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results.xml',
    },
  },
  resolve: {
    alias: {
      '#components': resolve(__dirname, 'tests/nuxt-components.ts'),
      '#imports': resolve(__dirname, 'tests/nuxt-imports.ts'),
      'vue-i18n': resolve(__dirname, 'tests/vue-i18n.ts'),
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
    },
  },
})
