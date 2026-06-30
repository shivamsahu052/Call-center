import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import CallTranscription from './pages/CallTranscription.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import './App.css'

function AuthScreen() {
  const { currentUser, logout } = useAuth()

  if (currentUser) {
    return <CallTranscription currentUser={currentUser} onLogout={logout} />
  }

  return <AuthSwitcher />
}

function AuthSwitcher() {
  const initialMode =
    new URLSearchParams(window.location.search).get('mode') === 'register'
      ? 'register'
      : 'login'
  const [mode, setMode] = useState(initialMode)

  return (
    <main className="auth-shell">
      {mode === 'login' ? (
        <Login onShowRegister={() => setMode('register')} />
      ) : (
        <Register onShowLogin={() => setMode('login')} />
      )}
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthScreen />
    </AuthProvider>
  )
}

export default App
