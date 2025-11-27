import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { preloadEssentialData, clearOldCache } from './utils/offlineQueries'

// Initialize the application
const root = createRoot(document.getElementById("root")!)
root.render(<App />)

// Preload essential data after app renders (VitePWA handles SW registration)
setTimeout(() => {
  clearOldCache();
  preloadEssentialData();
}, 3000);
