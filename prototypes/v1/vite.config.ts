import {defineConfig} from 'vite';
import {ignitionPlugin} from './server/ignition.mjs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {portalSessionPlugin} from './server/portal-session.mjs';
export default defineConfig({plugins:[ignitionPlugin(),react(),tailwindcss(),portalSessionPlugin()],server:{host:"127.0.0.1",port:5173,strictPort:true,proxy:{"/api/activation":process.env.ACTIVATION_API_ORIGIN??"http://127.0.0.1:7007","/api/diagnose":"http://127.0.0.1:8787","/api/conversations":"http://127.0.0.1:8787"}}});
