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
  const { managerEnrollmentKey, register } = useAuth()
  const [formData, setFormData] = useState(initialFormData)
  const [message, setMessage] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const result = register(formData)

    setMessage(result.message)
    setEmployeeId(result.ok ? result.user.employeeId : '')
  }

  return (
    <section className="auth-card" aria-labelledby="register-title">
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
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={updateField}
          required
        />

        <label htmlFor="register-confirm-password">Confirm Password</label>
        <input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={updateField}
          required
        />

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
            <input
              id="manager-key"
              name="managerKey"
              type="password"
              value={formData.managerKey}
              onChange={updateField}
              required
            />
            <p className="field-help">
              Demo key: <strong>{managerEnrollmentKey}</strong>
            </p>
          </div>
        ) : null}

        {message ? (
          <p className={`form-message ${employeeId ? 'success' : 'error'}`}>
            {message}
          </p>
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
    </section>
  )
}

export default Register
