import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { AdminProvider } from './context/AdminContext'
import { ThemeProvider } from './context/ThemeContext'
import { UserProvider } from './context/UserContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <UserProvider>
          <AdminProvider>
            <App />
          </AdminProvider>
        </UserProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
