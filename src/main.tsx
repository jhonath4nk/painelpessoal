import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initializeAuth } from './features/auth/auth-store'
import './styles/global.css'

await initializeAuth()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
