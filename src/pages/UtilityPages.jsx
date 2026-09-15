import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState(requestedMode)
  const { user, providers, login, demoLogin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMode(requestedMode)
  }, [requestedMode])

  const chooseMode = (nextMode) => {
    setMode(nextMode)
    setSearchParams({ mode: nextMode }, { replace: true })
  }

  const finishLogin = (nextUser) => {
    const fallback = nextUser.isCandidate ? '/candidates' : '/employers'
    navigate(location.state?.from || fallback, { replace: true })
  }

  const submitLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      finishLogin(await login(email, password))
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusy(false)
    }
  }

  const continueAs = async (persona) => {
    setBusy(true)
    setError('')
    try {
      finishLogin(await demoLogin(persona))
    } catch (nextError) {
      setError(nextError.message)
      setBusy(false)
    }
  }

  const entraReturnTo = location.state?.from || '/candidates'

  if (user) {
    return (
      <main id="main-content" className="auth-page">
        <section className="auth-brand-panel">
          <p className="eyebrow">Morrow accounts</p>
          <h1>You’re already signed in.</h1>
        </section>
        <section className="auth-form-panel">
          <div className="auth-form-wrap">
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
            <Link className="button button--dark" to={user.isCandidate ? '/candidates' : '/employers'}>
              Open your workspace
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main id="main-content" className="auth-page">
      <section className="auth-brand-panel">
        <p className="eyebrow">Morrow accounts</p>
        <h1>Keep your next move in one place.</h1>
        <p>
          Future accounts will connect saved jobs, resumes, applications, learning, and completed
          projects.
        </p>
        <ul>
          <li>
            <Check size={17} /> Candidate and employer journeys
          </li>
          <li>
            <Check size={17} /> Personal recommendations
          </li>
          <li>
            <Check size={17} /> Progress that follows your work
          </li>
        </ul>
      </section>
      <section className="auth-form-panel">
        <Link className="back-link" to="/">
          <ArrowLeft size={17} /> Back home
        </Link>
        <div className="auth-form-wrap">
          <PreviewNotice>
            {providers.entra.enabled
              ? 'Microsoft Entra ID and local demo authentication are available.'
              : 'Demo authentication is connected. Microsoft Entra ID is supported but currently disabled.'}
          </PreviewNotice>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => chooseMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'is-active' : ''}
              onClick={() => chooseMode('signup')}
            >
              Demo access
            </button>
          </div>
          <div>
            <p className="eyebrow">
              {mode === 'login' ? 'Welcome back' : 'Demo accounts'}
            </p>
            <h2>{mode === 'login' ? 'Log in to Morrow' : 'Choose a preview workspace'}</h2>
            <p>
              {mode === 'login'
                ? 'Use a seeded account or continue with one click.'
                : 'Public sign-up is intentionally disabled for this concept.'}
            </p>
          </div>
          {error && <PreviewNotice>{error}</PreviewNotice>}
          
          {mode === 'login' && (
            <form onSubmit={submitLogin}>
              {providers.entra.enabled && (
                <a
                  className="button button--outline"
                  href={`/api/auth/entra/login?returnTo=${encodeURIComponent(entraReturnTo)}`}
                >
                  Sign in with Microsoft
                </a>
              )}
              <label className="form-field form-field--with-icon">
                <span>Email address</span>
                <div>
                  <Mail size={18} />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="candidate@morrow.demo"
                    autoComplete="username"
                  />
                </div>
              </label>
              <label className="form-field form-field--with-icon">
                <span>Password</span>
                <div>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Demo account password"
                    autoComplete="current-password"
                  />
                </div>
              </label>
              <button className="button button--dark" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Log in'}
              </button>
            </form>
          )}

          <fieldset className="account-type" disabled={busy}>
            <legend>Quick demo access</legend>
            <button
              className="button button--outline"
              type="button"
              onClick={() => continueAs('candidate')}
            >
              <UserRound size={17} /> Continue as candidate
            </button>
            <button
              className="button button--outline"
              type="button"
              onClick={() => continueAs('employer')}
            >
              Continue as employer
            </button>
          </fieldset>
        </div>
      </section>
    </main>
  )
}

export function AccessDeniedPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="403"
        title="That workspace belongs to a different account type."
        copy="Your account is signed in, but it does not have permission to open this page."
        tone="sage"
      >
        <Link className="button button--dark" to="/">
          Return home
        </Link>
      </PageIntro>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="404"
        title="This page has not arrived yet."
        copy="The link may be out of date, or the page may still be part of a future Morrow release."
        tone="sage"
      >
        <Link className="button button--dark" to="/">
          Return home
        </Link>
      </PageIntro>
    </main>
  )
}