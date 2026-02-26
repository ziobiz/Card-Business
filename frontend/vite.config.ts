import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    // 프록시 미사용 - api.ts에서 VITE_API_URL로 직접 연결 (proxy error 방지)
  },
});
