
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize the application
const root = createRoot(document.getElementById("root")!)
root.render(<App />)
