import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ProfileProvider } from './components/ProfileContext.jsx'
import { LibraryProvider } from './components/LibraryContext.jsx'
import { ToastProvider } from './components/ToastContext.jsx'

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <ProfileProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </ProfileProvider>
  </ToastProvider>
)
