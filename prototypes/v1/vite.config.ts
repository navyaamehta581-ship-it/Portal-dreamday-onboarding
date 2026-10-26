import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {createApiProxy} from './dev/api-proxy';
export default defineConfig({
  plugins:[react(),tailwindcss()],
  server:{
    host:'127.0.0.1',port:5173,strictPort:true,
    proxy:{
      '/api/diagnose':createApiProxy(process.env.CODESPACE_NAME),
      '/api/conversations':createApiProxy(process.env.CODESPACE_NAME),
    },
  },
});
