import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function Login({ onShowRegister }) {
  const { login } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const result = login(formData)

    if (!result.ok) {
      setMessage(result.message)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <p className="eyebrow">AI Call Center Evaluation</p>
      <h1 id="login-title">Welcome Back</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={updateField}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={formData.password}
          onChange={updateField}
          required
        />

        {message ? <p className="form-message error">{message}</p> : null}

        <button className="primary-button" type="submit">
          Login
        </button>
      </form>

      <div className="auth-links">
        <button type="button" className="text-button">
          Forgot Password?
        </button>
        <span>Don't have an account?</span>
        <button type="button" className="text-button" onClick={onShowRegister}>
          Register
        </button>
      </div>
    </section>
  )
}

export default Login
