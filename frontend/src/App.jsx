import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import './App.css'

function AuthScreen() {
  const { currentUser, logout } = useAuth()

  if (currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card compact-card" aria-labelledby="welcome-title">
          <p className="eyebrow">AI Call Center Evaluation</p>
          <h1 id="welcome-title">Welcome, {currentUser.fullName}</h1>
          <div className="account-summary">
            <span>{currentUser.role}</span>
            <strong>{currentUser.employeeId}</strong>
          </div>
          <p className="muted">
            You are logged in successfully. Dashboard pages can be connected after
            this authentication step is ready.
          </p>
          <button className="primary-button" type="button" onClick={logout}>
            Logout
          </button>
        </section>
      </main>
    )
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
