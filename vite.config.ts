import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',manifest:{name:'AIAP — Association of Ivoirian in Andhra University',short_name:'AIAP',description:'Community and association platform for Ivoirians in Andhra Pradesh.',theme_color:'#C1121F',background_color:'#fffaf7',display:'standalone',start_url:'/',icons:[{src:'/aiap-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'/index.html'}})]});
