import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import'./index.css';import'./tailwind.css';import App from'./App';
if(import.meta.env.DEV&&'serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{});}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
