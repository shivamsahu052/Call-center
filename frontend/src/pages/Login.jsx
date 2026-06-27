import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function Login({ onShowRegister }) {
  const { login, resetInitiate, resetComplete } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStep, setResetStep] = useState(1)
  const [resetOtp, setResetOtp] = useState('')
  const [visibleOtp, setVisibleOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function isValidPassword(password) {
    return /^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$/.test(password)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (!isValidEmail(formData.email)) {
      setMessage('Please enter a valid email address.')
      return
    }

    if (!isValidPassword(formData.password)) {
      setMessage(
        'Password must have 8+ chars, uppercase, lowercase, number, and special symbol.',
      )
      return
    }

    const result = await login(formData)

    if (!result.ok) {
      setMessage(result.message)
    }
  }

  return (
    <section className="auth-card auth-card--login" aria-labelledby="login-title">
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
        <div className="password-field">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={formData.password}
            onChange={updateField}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            )}
          </button>
        </div>

        {message ? <p className="form-message error">{message}</p> : null}

        <button className="primary-button" type="submit">
          Login
        </button>
      </form>

      <div className="auth-links">
        <button type="button" className="text-button" onClick={() => { setShowResetModal(true); setResetStep(1); setResetEmail(formData.email || ''); }}>
          Forgot Password?
        </button>
        <span>Don't have an account?</span>
        <button type="button" className="text-button" onClick={onShowRegister}>
          Register
        </button>
      </div>

      {showResetModal ? (
        <div className="otp-backdrop" role="dialog" aria-modal="true">
          <div className="otp-modal">
            {resetStep === 1 ? (
              <>
                <div className="otp-modal-header">
                  <div>
                    <h2>Reset Password</h2>
                    <p className="otp-modal-subtitle">Enter your email to receive a one-time password.</p>
                  </div>
                  <button type="button" className="otp-close-button" onClick={() => setShowResetModal(false)} aria-label="Close reset password dialog">
                    ×
                  </button>
                </div>
                <form
                  className="otp-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setMessage('')
                    const res = await resetInitiate({ email: resetEmail })
                    if (!res.ok) {
                      setMessage(res.message)
                      return
                    }
                    setVisibleOtp(res.otp || '')
                    setResetStep(2)
                    setMessage(res.message)
                  }}
                >
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />

                  {visibleOtp ? (
                    <div className="otp-code-card" role="status">
                      <p className="otp-code-label">OTP sent to your email</p>
                      <div className="otp-code-value">{visibleOtp}</div>
                      <p className="otp-code-help">Use this code to continue the reset flow.</p>
                    </div>
                  ) : null}

                  <div className="otp-actions">
                    <button type="button" className="text-button" onClick={() => setShowResetModal(false)}>
                      Cancel
                    </button>
                    <button className="primary-button" type="submit">
                      Send OTP
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="otp-modal-header">
                  <div>
                    <h2>Enter OTP & New Password</h2>
                    <p className="otp-modal-subtitle">We sent a code to <strong>{resetEmail}</strong>. Enter it below to finish resetting.</p>
                  </div>
                  <button type="button" className="otp-close-button" onClick={() => setShowResetModal(false)} aria-label="Close reset password dialog">
                    ×
                  </button>
                </div>
                <form
                  className="otp-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setMessage('')
                    if (newPassword !== confirmNewPassword) {
                      setMessage('Passwords must match')
                      return
                    }
                    const res = await resetComplete({ email: resetEmail, otp: resetOtp, newPassword, confirmPassword: confirmNewPassword })
                    if (!res.ok) {
                      setMessage(res.message)
                      return
                    }
                    setShowResetModal(false)
                    setMessage(res.message)
                  }}
                >
                  <label htmlFor="reset-otp">OTP Code</label>
                  <input
                    id="reset-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    required
                  />

                  <label htmlFor="reset-new-password">New Password</label>
                  <div className="password-field">
                    <input
                      id="reset-new-password"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword((c) => !c)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <label htmlFor="reset-confirm-password">Confirm New Password</label>
                  <div className="password-field">
                    <input
                      id="reset-confirm-password"
                      name="confirmNewPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  {message ? <p className="form-message error">{message}</p> : null}

                  <div className="otp-actions">
                    <button type="button" className="text-button" onClick={() => setShowResetModal(false)}>
                      Cancel
                    </button>
                    <button className="primary-button" type="submit">
                      Reset Password
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Login
