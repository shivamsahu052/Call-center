import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api.js'

const AuthContext = createContext(null)

const SESSION_STORAGE_KEY = 'call-center-session'
const MANAGER_ENROLLMENT_KEY = 'MANAGER-2026'

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

async function apiFetch(path, data) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.detail || payload.message || 'Request failed')
  }

  return payload
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() =>
    readJson(SESSION_STORAGE_KEY, null),
  )

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser))
      return
    }

    localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [currentUser])

  async function login(payload) {
    try {
      const result = await apiFetch('/api/auth/login', payload)
      setCurrentUser(result.user)
      return { ok: true, user: result.user }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  async function registerInitiate(payload) {
    try {
      await apiFetch('/api/auth/register-initiate', payload)
      return {
        ok: true,
        message: 'An OTP has been sent to your email. Please verify it to complete registration.',
      }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  async function verifyRegistration(payload) {
    try {
      const result = await apiFetch('/api/auth/register-verify', payload)
      setCurrentUser(result.user)
      return { ok: true, user: result.user, message: result.message }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  async function resetInitiate(payload) {
    try {
      const result = await apiFetch('/api/auth/reset-initiate', payload)
      return { ok: true, message: result.message, otp: result.otp }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  async function resetComplete(payload) {
    try {
      const result = await apiFetch('/api/auth/reset-complete', payload)
      // Do not auto-login; optionally return user info
      return { ok: true, message: result.message }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  function logout() {
    setCurrentUser(null)
  }

  const value = useMemo(
    () => ({
      currentUser,
      login,
      logout,
      managerEnrollmentKey: MANAGER_ENROLLMENT_KEY,
      registerInitiate,
      verifyRegistration,
      resetInitiate,
      resetComplete,
    }),
    [currentUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

function stripPrivateFields(user) {
  const { password, ...safeUser } = user
  return safeUser
}
