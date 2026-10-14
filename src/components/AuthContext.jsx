import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authenticatedRequest, logoutSession, parseResponse } from './authClient.js'
import { resolveOrganization, savedOrganizationId, saveOrganizationId } from './organizationSelection.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [csrfToken, setCsrfToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mailNotice, setMailNotice] = useState('')
  const [mailTransport, setMailTransport] = useState('smtp')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null)

  const applyAuth = useCallback((data) => {
    setUser(data?.user ?? null)
    setCsrfToken(data?.csrfToken ?? null)
    if (data?.mailTransport) setMailTransport(data.mailTransport)
    setMailNotice(data?.verificationEmailSent === false ? 'Your account was created, but the verification email could not be sent. Please try again below.' : '')
    setSelectedOrganizationId(data?.user ? savedOrganizationId(data.user.id) : null)
    return data?.user ?? null
  }, [])

  const refreshAuth = useCallback(async (organizationId) => {
    const data = await fetch('/api/auth/me', { cache: 'no-store' }).then(parseResponse)
    if (data.user?.organizations.some(({ id }) => id === organizationId)) {
      saveOrganizationId(data.user.id, organizationId)
    }
    return applyAuth(data)
  }, [applyAuth])

  const selectOrganization = useCallback((id) => {
    if (!user?.organizations.some((organization) => organization.id === id)) return
    setSelectedOrganizationId(id)
    saveOrganizationId(user.id, id)
  }, [user])

  const activeOrganization = resolveOrganization(user, selectedOrganizationId)

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
  const signup = useCallback(
    (details) => authenticate('/api/auth/signup', details),
    [authenticate],
  )

  const logout = useCallback(async () => {
    await logoutSession(csrfToken, () => applyAuth(null))
  }, [applyAuth, csrfToken])

  const apiFetch = useCallback(async (path, options = {}) => {
    const method = (options.method ?? 'GET').toUpperCase()
    const headers = new Headers(options.headers)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    return authenticatedRequest(path, { ...options, headers }, () => applyAuth(null))
  }, [csrfToken, applyAuth])

  const value = useMemo(() => ({ user, loading, login, signup, logout, apiFetch, refreshAuth, activeOrganization, selectOrganization, mailNotice, mailTransport }), [
    user, loading, login, signup, logout, apiFetch, refreshAuth, activeOrganization, selectOrganization, mailNotice, mailTransport,
  ])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function AuthGate({ capability, children }) {
  const { user, loading, activeOrganization } = useAuth()
  const location = useLocation()
  if (loading) {
    return <main id="main-content" className="product-page"><div className="page-container"><p>Checking account access…</p></div></main>
  }
  if (!user) {
    return <Navigate to="/auth?mode=login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  }
  if (capability && !user.emailVerified) {
    return <Navigate to="/account" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  }
  const allowed = capability === 'candidate'
    ? user.isCandidate
    : capability === 'employer'
      ? user.organizations.length > 0
      : true
  if (!allowed) return <Navigate to="/forbidden" replace />
  return <Fragment key={capability === 'employer' ? activeOrganization?.id : user.id}>{children}</Fragment>
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
