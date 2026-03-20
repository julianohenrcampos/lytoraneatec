import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { preloadEssentialData, clearOldCache } from './utils/offlineQueries'

// Initialize the application
const container = document.getElementById("root")!
const root = createRoot(container)

function renderApp() {
  root.render(<App />)
}

renderApp()

// Preload essential data after app renders (VitePWA handles SW registration)
setTimeout(() => {
  clearOldCache();
  preloadEssentialData();
}, 3000);
