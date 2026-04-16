import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ProfileProvider } from './components/ProfileContext.jsx'
import { LibraryProvider } from './components/LibraryContext.jsx'
import { ToastProvider } from './components/ToastContext.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ToastProvider>
      <ProfileProvider>
        <LibraryProvider>
          <App />
        </LibraryProvider>
      </ProfileProvider>
    </ToastProvider>
  </BrowserRouter>
)
