import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const initialFormData = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'Employee',
  managerKey: '',
}

function Register({ onShowLogin }) {
  const { managerEnrollmentKey, registerInitiate, verifyRegistration } = useAuth()
  const [formData, setFormData] = useState(initialFormData)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [otp, setOtp] = useState('')
  const [emailForOtp, setEmailForOtp] = useState('')
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showManagerKey, setShowManagerKey] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setMessageType('error')

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords must match.')
      return
    }

    if (!formData.email || !formData.password || !formData.fullName) {
      setMessage('Please complete all required fields.')
      return
    }

    const result = await registerInitiate(formData)

    if (!result.ok) {
      setMessage(result.message)
      return
    }

    setEmailForOtp(formData.email)
    setShowOtpModal(true)
    setMessageType('success')
    setMessage(result.message)
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    setMessage('')
    setMessageType('error')

    const result = await verifyRegistration({ email: emailForOtp, otp })

    if (!result.ok) {
      setMessage(result.message)
      return
    }

    setShowOtpModal(false)
    setMessageType('success')
    setMessage(result.message)
  }

  return (
    <section className="auth-card auth-card--register" aria-labelledby="register-title">
      <p className="eyebrow">AI Call Center Evaluation</p>
      <h1 id="register-title">Create Account</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="register-name">Full Name</label>
        <input
          id="register-name"
          name="fullName"
          type="text"
          autoComplete="name"
          value={formData.fullName}
          onChange={updateField}
          required
        />

        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={updateField}
          required
        />

        <label htmlFor="register-password">Password</label>
        <div className="password-field">
          <input
            id="register-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
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

        <label htmlFor="register-confirm-password">Confirm Password</label>
        <div className="password-field">
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={updateField}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmPassword((current) => !current)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
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

        <fieldset className="role-fieldset">
          <legend>Role</legend>
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
        </fieldset>

        {formData.role === 'Manager' ? (
          <div className="manager-key-block">
            <label htmlFor="manager-key">Manager Enrollment Key</label>
              <div className="password-field">
                <input
                  id="manager-key"
                  name="managerKey"
                  type={showManagerKey ? 'text' : 'password'}
                  value={formData.managerKey}
                  onChange={updateField}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowManagerKey((c) => !c)}
                  aria-label={showManagerKey ? 'Hide manager key' : 'Show manager key'}
                >
                  {showManagerKey ? (
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
            <p className="field-help">
              Demo key: <strong>{managerEnrollmentKey}</strong>
            </p>
          </div>
        ) : null}

        {message ? (
          <p className={`form-message ${messageType}`}>{message}</p>
        ) : null}

        <button className="primary-button" type="submit">
          Register
        </button>
      </form>

      <div className="auth-links">
        <span>Already have an account?</span>
        <button type="button" className="text-button" onClick={onShowLogin}>
          Login
        </button>
      </div>

      {showOtpModal ? (
        <div className="otp-backdrop" role="dialog" aria-modal="true">
          <div className="otp-modal">
            <h2>Verify your email</h2>
            <p>Enter the OTP sent to <strong>{emailForOtp}</strong>.</p>
            <form onSubmit={handleVerifyOtp} className="otp-form">
              <label htmlFor="otp-code">OTP Code</label>
              <input
                id="otp-code"
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
              />
              <div className="otp-actions">
                <button type="button" className="text-button" onClick={() => setShowOtpModal(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Verify OTP
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Register
