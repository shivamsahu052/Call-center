import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { API_BASE_URL, authHeaders } from '../config/api.js'

const AuthContext = createContext(null)

const SESSION_STORAGE_KEY = 'call-center-session'
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

async function apiFetch(path, data) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch {
    throw new Error(`Cannot reach API server at ${API_BASE_URL}`)
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      response.status === 502 || response.status === 504
        ? 'The API server is temporarily unavailable. Start the backend server and try again.'
        : payload.detail || payload.message || 'Request failed'

    throw new Error(message)
  }

  return payload
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let inactivityTimerId

    function resetInactivityTimer() {
      window.clearTimeout(inactivityTimerId)
      inactivityTimerId = window.setTimeout(() => {
        setCurrentUser(null)
      }, INACTIVITY_TIMEOUT_MS)
    }

    const activityEvents = [
      'click',
      'keydown',
      'mousemove',
      'pointerdown',
      'scroll',
      'touchstart',
    ]

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true })
    })
    resetInactivityTimer()

    return () => {
      window.clearTimeout(inactivityTimerId)
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer)
      })
    }
  }, [currentUser])

  const login = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/login', payload)
      setCurrentUser(result.user)
      return { ok: true, user: result.user }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const registerInitiate = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/register-initiate', payload)
      return {
        ok: true,
        message: result.message || 'An OTP has been sent to your email. Please verify it to complete registration.',
      }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const resendRegistrationOtp = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/register-resend-otp', payload)
      return { ok: true, message: result.message }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const verifyRegistration = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/register-verify', payload)
      if (result.user) {
        setCurrentUser(result.user)
      }
      return {
        ok: true,
        user: result.user,
        message: result.message,
        requiresApproval: result.requiresApproval,
        role: result.role,
        managerName: result.managerName,
      }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const resetInitiate = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/reset-initiate', payload)
      return { ok: true, message: result.message, otp: result.otp }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const resetComplete = useCallback(async (payload) => {
    try {
      const result = await apiFetch('/api/auth/reset-complete', payload)
      // Do not auto-login; optionally return user info
      return { ok: true, message: result.message }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [])

  const loadInbox = useCallback(async () => {
    if (!currentUser) {
      return { ok: false, message: 'You must be logged in to view inbox messages.' }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/inbox`, {
        headers: authHeaders(currentUser),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Unable to load inbox.')
      }

      return {
        ok: true,
        messages: payload.messages || [],
        unreadCount: payload.unreadCount || 0,
      }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [currentUser])

  const markInboxMessageRead = useCallback(async (messageId) => {
    if (!currentUser) {
      return { ok: false, message: 'You must be logged in to update inbox messages.' }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/inbox/${encodeURIComponent(messageId)}/read`, {
        method: 'POST',
        headers: authHeaders(currentUser),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Unable to update inbox message.')
      }

      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [currentUser])

  const decideApproval = useCallback(async (approvalId, decision) => {
    if (!currentUser) {
      return { ok: false, message: 'You must be logged in to approve requests.' }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/approval-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(currentUser),
        },
        body: JSON.stringify({ approvalId, decision }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Unable to update approval request.')
      }

      return { ok: true, message: payload.message }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }, [currentUser])

  const logout = useCallback(() => {
    setCurrentUser(null)
  }, [])

  const value = {
    currentUser,
    login,
    logout,
    registerInitiate,
    resendRegistrationOtp,
    verifyRegistration,
    resetInitiate,
    resetComplete,
    loadInbox,
    markInboxMessageRead,
    decideApproval,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

