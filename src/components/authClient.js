export async function parseResponse(response) {
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export async function authenticatedRequest(path, options, clearAuth) {
  const response = await fetch(path, options)
  if (response.status === 401) clearAuth()
  return parseResponse(response)
}

export async function logoutSession(csrfToken, clearAuth) {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
  })
  if (response.status !== 401) await parseResponse(response)
  clearAuth()
}
