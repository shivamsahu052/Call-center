export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export function authHeaders(currentUser) {
  if (!currentUser) {
    return {}
  }

  return {
    'X-User-Employee-Id': currentUser.employeeId || '',
    'X-User-Role': currentUser.role || '',
  }
}
