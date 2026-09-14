import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const AuthContext = createContext(null)

async function parseResponse(response) {
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [csrfToken, setCsrfToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState({
    demo: { enabled: true },
    entra: { enabled: false, configured: false, status: 'loading' },
  })

  const applyAuth = useCallback((data) => {
    setUser(data?.user ?? null)
    setCsrfToken(data?.csrfToken ?? null)
    return data?.user ?? null
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetch('/api/auth/me', { signal: controller.signal })
      .then(parseResponse)
      .then((data) => { if (active) applyAuth(data) })
      .catch((error) => {
        if (active && error.name !== 'AbortError') applyAuth(null)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      controller.abort()
    }
  }, [applyAuth])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/providers', { signal: controller.signal })
      .then(parseResponse)
      .then(setProviders)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const authenticate = useCallback(async (path, body) => {
    const data = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(parseResponse)
    return applyAuth(data)
  }, [applyAuth])

  const login = useCallback(
    (email, password) => authenticate('/api/auth/login', { email, password }),
    [authenticate],
  )
  const demoLogin = useCallback(
    (persona) => authenticate('/api/auth/demo-login', { persona }),
    [authenticate],
  )

  const logout = useCallback(async () => {
    if (csrfToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      }).then(parseResponse)
    }
    applyAuth(null)
  }, [applyAuth, csrfToken])

  const apiFetch = useCallback(async (path, options = {}) => {
    const method = (options.method ?? 'GET').toUpperCase()
    const headers = new Headers(options.headers)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    return fetch(path, { ...options, headers }).then(parseResponse)
  }, [csrfToken])

  const value = useMemo(() => ({ user, loading, providers, login, demoLogin, logout, apiFetch }), [
    user, loading, providers, login, demoLogin, logout, apiFetch,
  ])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function AuthGate({ capability, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return <main id="main-content" className="product-page"><div className="page-container"><p>Checking account access…</p></div></main>
  }
  if (!user) {
    return <Navigate to="/auth?mode=login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  const allowed = capability === 'candidate'
    ? user.isCandidate
    : capability === 'employer'
      ? user.organizations.length > 0
      : true
  if (!allowed) return <Navigate to="/forbidden" replace />
  return children
}

export function RequireAuth({ children }) {
  return <AuthGate>{children}</AuthGate>
}

export function RequireCandidate({ children }) {
  return <AuthGate capability="candidate">{children}</AuthGate>
}

export function RequireEmployer({ children }) {
  return <AuthGate capability="employer">{children}</AuthGate>
}
