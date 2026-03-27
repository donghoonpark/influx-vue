import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const influxProxy = {
  '/api': {
    target: 'http://127.0.0.1:8086',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: influxProxy,
  },
  preview: {
    proxy: influxProxy,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'InfluxVue',
      fileName: 'influx-vue',
    },
    rollupOptions: {
      external: [
        /^vue($|\/)/,
        /^naive-ui($|\/)/,
        /^echarts($|\/)/,
        /^vue-echarts($|\/)/,
        /^@influxdata\/influxdb-client-browser($|\/)/,
        /^date-fns($|\/)/,
      ],
      output: {
        globals: {
          vue: 'Vue',
          'naive-ui': 'naiveui',
          echarts: 'echarts',
          'echarts/core': 'echarts',
          'echarts/charts': 'echarts',
          'echarts/components': 'echarts',
          'echarts/renderers': 'echarts',
          'vue-echarts': 'VueECharts',
          '@influxdata/influxdb-client-browser': 'InfluxDBClientBrowser',
          'date-fns': 'dateFns',
        },
      },
    },
  },
})
