import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, Check, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState(requestedMode)
  const { user, login, signup } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState('candidate')
  const [companyName, setCompanyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMode(requestedMode)
  }, [requestedMode])

  const chooseMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setSearchParams({ mode: nextMode }, { replace: true })
  }

  const finishLogin = (nextUser) => {
    const fallback = nextUser.isCandidate ? '/candidates' : '/employers'
    navigate(location.state?.from || fallback, { replace: true })
  }

  const submit = (authenticate) => async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      finishLogin(await authenticate())
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setBusy(false)
    }
  }

  const submitLogin = submit(() => login(email, password))
  const submitSignup = submit(() =>
    signup({
      email,
      password,
      displayName,
      accountType,
      companyName: accountType === 'employer' ? companyName : undefined,
    }),
  )

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
              Sign up
            </button>
          </div>
          <div>
            <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'New to Morrow'}</p>
            <h2>{mode === 'login' ? 'Log in to Morrow' : 'Create your account'}</h2>
            <p>
              {mode === 'login'
                ? 'Use the email and password you signed up with.'
                : 'Sign up as a candidate looking for work, or as an employer hiring for your company.'}
            </p>
          </div>
          {error && <PreviewNotice>{error}</PreviewNotice>}
          
          {mode === 'login' && (
            <form onSubmit={submitLogin}>
              <label className="form-field form-field--with-icon">
                <span>Email address</span>
                <div>
                  <Mail size={18} />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
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
                    placeholder="Your password"
                    autoComplete="current-password"
                  />
                </div>
              </label>
              <button className="button button--dark" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Log in'}
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={submitSignup}>
              <fieldset className="account-type" disabled={busy}>
                <legend>I am signing up as</legend>
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    value="candidate"
                    checked={accountType === 'candidate'}
                    onChange={() => setAccountType('candidate')}
                  />
                  <UserRound size={17} /> Candidate
                </label>
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    value="employer"
                    checked={accountType === 'employer'}
                    onChange={() => setAccountType('employer')}
                  />
                  <Building2 size={17} /> Employer
                </label>
              </fieldset>
              <label className="form-field form-field--with-icon">
                <span>Full name</span>
                <div>
                  <UserRound size={18} />
                  <input
                    required
                    maxLength={80}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                  />
                </div>
              </label>
              {accountType === 'employer' && (
                <label className="form-field form-field--with-icon">
                  <span>Company name</span>
                  <div>
                    <Building2 size={18} />
                    <input
                      required
                      maxLength={100}
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                </label>
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
                    placeholder="you@example.com"
                    autoComplete="email"
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
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
              </label>
              <button className="button button--dark" type="submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
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