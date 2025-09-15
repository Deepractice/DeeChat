import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          // Don't externalize our internal dependencies
          '@deepracticex/*'
        ]
      })
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'main/index.ts')
        },
        output: {
          format: 'es'
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'main'),
        '@shared': resolve(__dirname, 'shared')
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'main/preload.ts')
        },
        output: {
          format: 'cjs',  // Preload 必须是 CommonJS
          entryFileNames: 'preload.js'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'renderer/index.html')
        }
      }
    }
  }
})