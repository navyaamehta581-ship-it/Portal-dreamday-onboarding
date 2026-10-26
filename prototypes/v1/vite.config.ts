import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],server:{host:"127.0.0.1",port:5173,strictPort:true,proxy:{"/api/activation":"http://127.0.0.1:7007","/api/diagnose":"http://127.0.0.1:8787","/api/conversations":"http://127.0.0.1:8787"}}});
