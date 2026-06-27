import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const USERS_STORAGE_KEY = 'call-center-users'
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

function createEmployeeId(role, users) {
  const prefix = role === 'Manager' ? 'MGR' : 'EMP'
  let employeeId = ''

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000)
    employeeId = `${prefix}-${randomNumber}`
  } while (users.some((user) => user.employeeId === employeeId))

  return employeeId
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => readJson(USERS_STORAGE_KEY, []))
  const [currentUser, setCurrentUser] = useState(() =>
    readJson(SESSION_STORAGE_KEY, null),
  )

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  }, [users])

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser))
      return
    }

    localStorage.removeItem(SESSION_STORAGE_KEY)
  }, [currentUser])

  function register(payload) {
    const fullName = payload.fullName.trim()
    const email = normalizeEmail(payload.email)
    const role = payload.role

    if (!fullName || !email || !payload.password || !payload.confirmPassword) {
      return { ok: false, message: 'Please fill in every required field.' }
    }

    if (payload.password.length < 6) {
      return {
        ok: false,
        message: 'Password must be at least 6 characters long.',
      }
    }

    if (payload.password !== payload.confirmPassword) {
      return { ok: false, message: 'Passwords do not match.' }
    }

    if (users.some((user) => user.email === email)) {
      return { ok: false, message: 'An account already exists for this email.' }
    }

    if (role === 'Manager') {
      const managerExists = users.some((user) => user.role === 'Manager')

      if (managerExists) {
        return {
          ok: false,
          message: 'A manager is already enrolled for this evaluation portal.',
        }
      }

      if (payload.managerKey.trim() !== MANAGER_ENROLLMENT_KEY) {
        return {
          ok: false,
          message: 'Manager enrollment key is invalid.',
        }
      }
    }

    const newUser = {
      fullName,
      email,
      password: payload.password,
      role,
      employeeId: createEmployeeId(role, users),
      createdAt: new Date().toISOString(),
    }

    setUsers((previousUsers) => [...previousUsers, newUser])
    setCurrentUser(stripPrivateFields(newUser))

    return {
      ok: true,
      message: `Account created. Your employee ID is ${newUser.employeeId}.`,
      user: stripPrivateFields(newUser),
    }
  }

  function login({ email, password }) {
    const normalizedEmail = normalizeEmail(email)
    const foundUser = users.find(
      (user) => user.email === normalizedEmail && user.password === password,
    )

    if (!foundUser) {
      return { ok: false, message: 'Invalid email or password.' }
    }

    const safeUser = stripPrivateFields(foundUser)
    setCurrentUser(safeUser)
    return { ok: true, user: safeUser }
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
      register,
      users,
    }),
    [currentUser, users],
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
