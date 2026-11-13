import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Hub from './Hub.jsx'
import { isDriveApp } from './config.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDriveApp() ? <App /> : <Hub />}
  </StrictMode>,
)
