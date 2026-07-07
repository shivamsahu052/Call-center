import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function Login({ onShowRegister }) {
  const { login, resetInitiate, resetComplete } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '', role: 'Employee' })
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [pendingApprovalEmail, setPendingApprovalEmail] = useState('')
  const [showPendingApprovalModal, setShowPendingApprovalModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStep, setResetStep] = useState(1)
  const [resetOtp, setResetOtp] = useState('')
  const [visibleOtp, setVisibleOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isResendingResetOtp, setIsResendingResetOtp] = useState(false)

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
      if (result.message && result.message.toLowerCase().includes('approval pending')) {
        setPendingApprovalEmail(formData.email)
        setShowPendingApprovalModal(true)
      }
      setMessage(result.message)
    }
  }

  async function resendResetOtp() {
    setIsResendingResetOtp(true)
    setMessage('')

    const res = await resetInitiate({ email: resetEmail })

    setIsResendingResetOtp(false)

    if (!res.ok) {
      setMessage(res.message)
      return
    }

    setVisibleOtp(res.otp || '')
    setResetOtp('')
    setMessage(res.message)
  }

  return (
    <section className="auth-card auth-card--login" aria-labelledby="login-title">
      <div className="login-form-panel">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" focusable="false">
              <path d="M10 25a14 14 0 0 1 28 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M13 25v6a4 4 0 0 0 4 4h3V24h-3a4 4 0 0 0-4 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <path d="M35 25v6a4 4 0 0 1-4 4h-3V24h3a4 4 0 0 1 4 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <path d="M28 35h-5a4 4 0 0 1-4-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span>SageSmart-CallCentre</span>
        </div>

        <p className="eyebrow">SageSmart-CallCentre</p>
        <h1 id="login-title">Log in</h1>
        <p className="login-subtitle">
          Enter your credentials to continue reviewing calls, coaching insights, and service performance.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <fieldset className="role-fieldset role-fieldset--login">
            <legend>Login as</legend>
            <label className="radio-option">
              <input
                name="role"
                type="radio"
                value="Employee"
                checked={formData.role === 'Employee'}
                onChange={updateField}
              />
              Employee
            </label>
            <label className="radio-option">
              <input
                name="role"
                type="radio"
                value="Manager"
                checked={formData.role === 'Manager'}
                onChange={updateField}
              />
              Manager
            </label>
          </fieldset>

          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="user@example.com"
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
              placeholder="Enter your password"
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

          <button type="button" className="forgot-link" onClick={() => { setShowResetModal(true); setResetStep(1); setResetEmail(formData.email || ''); }}>
            Forgot Password?
          </button>

          {message ? <p className="form-message error">{message}</p> : null}

          <button className="primary-button" type="submit">
            Log in
          </button>
        </form>

        <div className="registration-callout">
          <div className="registration-copy">
            <strong>New to SageSmart-CallCentre?</strong>
            <span>Create an employee or manager account to start evaluating calls.</span>
          </div>
          <button type="button" className="register-button" onClick={onShowRegister}>
            Register
          </button>
        </div>
      </div>

      <aside className="login-visual-panel" aria-label="Call center intelligence preview">
        <div className="login-quote">
          <p>
            Every customer conversation tells a story. Capture it clearly, coach faster,
            and help every agent improve with confidence.
          </p>
          <div className="login-quote-author">
            <span className="quote-logo" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path d="M11 25a13 13 0 0 1 26 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M15 25v7h5V23h-3a2 2 0 0 0-2 2Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M33 25v7h-5V23h3a2 2 0 0 1 2 2Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M28 35h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
            <strong>SageSmart-CallCentre</strong>
            <small>Quality, coaching, and performance in one place</small>
          </div>
        </div>

        <div className="call-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="orbit-ring orbit-ring-three" />
          <span className="orbit-node node-one">CS</span>
          <span className="orbit-node node-two">AI</span>
          <span className="orbit-node node-three">QA</span>
          <span className="orbit-node node-four">CX</span>
          <span className="orbit-node node-five">24</span>
          <div className="orbit-core">
            <svg viewBox="0 0 72 72" focusable="false">
              <path d="M17 38a19 19 0 0 1 38 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M20 38v8a6 6 0 0 0 6 6h4V35h-4a6 6 0 0 0-6 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
              <path d="M52 38v8a6 6 0 0 1-6 6h-4V35h4a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
              <path d="M43 53h-8a7 7 0 0 1-7-7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </aside>

      {showPendingApprovalModal ? (
        <div className="otp-backdrop" role="dialog" aria-modal="true">
          <div className="otp-modal">
            <h2>Approval Pending</h2>
            <p>Your {formData.role.toLowerCase()} registration request for <strong>{pendingApprovalEmail}</strong> is still waiting for approval.</p>
            <p className="otp-modal-subtitle">You will be able to log in once the manager approves your request.</p>
            <div className="otp-actions">
              <button type="button" className="primary-button" onClick={() => setShowPendingApprovalModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                    x
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
                    x
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

                  {visibleOtp ? (
                    <div className="otp-code-card" role="status">
                      <p className="otp-code-label">Latest OTP</p>
                      <div className="otp-code-value">{visibleOtp}</div>
                      <p className="otp-code-help">Use this code before requesting another one.</p>
                    </div>
                  ) : null}

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
                    <button type="button" className="text-button" onClick={resendResetOtp} disabled={isResendingResetOtp}>
                      {isResendingResetOtp ? 'Sending...' : 'Resend OTP'}
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
