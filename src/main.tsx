// Limpeza defensiva de qualquer Service Worker / cache antigo que possa ter
// sido registrado por versões anteriores do app. Isso roda apenas no boot e
// não bloqueia a renderização.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
    .catch(() => {});
}
if (typeof window !== 'undefined' && 'caches' in window) {
  caches
    .keys()
    .then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})))
    .catch(() => {});
}

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;
createRoot(container).render(<App />);
