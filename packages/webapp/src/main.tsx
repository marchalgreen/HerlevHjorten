import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/ui/Toast'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element mangler')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
  </React.StrictMode>
)
