import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Temporal } from 'temporal-polyfill'
import './index.css'
import App from './App.tsx'

// Install Temporal polyfill globally
(globalThis as unknown as { Temporal: typeof Temporal }).Temporal = Temporal

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
