import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Forces Vite to target standard, compatible ES Modules
    target: 'esnext' 
  }
})