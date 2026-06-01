import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from '@/lib/pwa/registerSW';

const container = document.getElementById('root')!;
createRoot(container).render(<App />);

// Registro defensivo do Service Worker (no-op em iframe/preview/localhost)
registerServiceWorker();
