import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'
import { initOfflineSync } from './lib/offlineSync'

// Carga el perfil (si hay sesión activa) antes de mostrar la app
useAuthStore.getState().loadProfile()

// Arranca la sincronización automática de acciones guardadas sin señal
initOfflineSync()

// Registro del service worker de notificaciones push (además del que
// genera vite-plugin-pwa automáticamente para el cacheo offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-push.js').catch(console.error)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
