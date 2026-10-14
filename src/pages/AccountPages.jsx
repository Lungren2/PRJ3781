import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageIntro } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'

const readToken = (hash) => new URLSearchParams(hash.slice(1)).get('token') ?? ''

function AccountShell({ title, children }) {
  return (
    <main id="main-content" className="product-page">
      <PageIntro eyebrow="Your account" title={title} />
      <div className="page-container account-content">
        <section className="form-surface account-form">{children}</section>
      </div>
    </main>
  )
}

export function AccountPage() {
  const { user, apiFetch, refreshAuth, mailNotice, mailTransport } = useAuth()
  const consoleMail = mailTransport === 'console'
  const location = useLocation()
  const [message, setMessage] = useState(mailNotice)
  const [busy, setBusy] = useState(false)
  async function resend() {
    setBusy(true)
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST' })
      setMessage(
        consoleMail
          ? 'Verification link printed in the API terminal.'
          : 'Verification email sent. Check your inbox.',
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  const destination = location.state?.from
  const from =
    typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
      ? destination
      : user.isCandidate
        ? '/candidates'
        : '/employers'
  return (
    <AccountShell
      title={
        user.emailVerified
          ? 'Your account'
          : consoleMail
            ? 'Verify your account'
            : 'Check your email'
      }
    >
      <h2>{user.displayName}</h2>
      <p>{user.email}</p>
      {user.emailVerified ? (
        <>
          <p>Your email is verified.</p>
          <Link className="button button--dark" to={from}>
            Continue
          </Link>
        </>
      ) : (
        <>
          <p>
            {consoleMail
              ? 'Local development: open the verification link printed in the API terminal.'
              : 'Open the verification email to finish setting up your account.'}
          </p>
          <button className="button button--dark" disabled={busy} onClick={resend}>
            {consoleMail ? 'Print verification link' : 'Send verification email'}
          </button>
          <button
            className="text-action"
            disabled={busy}
            onClick={async () => {
              try {
                const updated = await refreshAuth()
                if (!updated?.emailVerified) setMessage('Your email is not verified yet.')
              } catch (error) {
                setMessage(error.message)
              }
            }}
          >
            I have verified my email
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <Link to="/auth/forgot-password">Reset your password</Link>
    </AccountShell>
  )
}

export function VerifyEmailPage() {
  const { apiFetch, refreshAuth } = useAuth()
  const location = useLocation()
  const [token] = useState(() => readToken(location.hash))
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function verify() {
    setBusy(true)
    try {
      await apiFetch('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      await refreshAuth()
      setDone(true)
      navigate('/auth/verify', { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AccountShell title={done ? 'Email verified' : 'Verify your email'}>
      {done ? (
        <>
          <p>You can now use your account.</p>
          <Link to="/account">Continue to your account</Link>
          <Link to="/auth?mode=login">Log in</Link>
        </>
      ) : (
        <>
          <p>Confirm your email to finish setting up Morrow.</p>
          <button className="button button--dark" disabled={busy || !token} onClick={verify}>
            Verify email
          </button>
          {!token && <p>Open the link in your verification email.</p>}
        </>
      )}
      {message && <p role="alert">{message}</p>}
      <Link to="/account">Send a new verification email</Link>
    </AccountShell>
  )
}

export function ForgotPasswordPage() {
  const { apiFetch, mailTransport } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AccountShell title="Forgot your password?">
      <p>
        {mailTransport === 'console'
          ? 'Local development: reset links are printed in the API terminal.'
          : 'We will email you a link to choose a new password.'}
      </p>
      <form onSubmit={submit}>
        <label className="form-field">
          <span>Email address</span>
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="button button--dark" disabled={busy}>
          Send reset link
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <Link to="/auth?mode=login">Back to login</Link>
    </AccountShell>
  )
}

export function ResetPasswordPage() {
  const { apiFetch, refreshAuth } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => readToken(location.hash))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (password !== confirmation) {
      setMessage('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      await refreshAuth()
      setPassword('')
      setConfirmation('')
      setDone(true)
      navigate('/auth/reset', { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AccountShell title={done ? 'Password changed' : 'Choose a new password'}>
      {done ? (
        <>
          <p>Log in with your new password. Your other sessions have been logged out.</p>
          <Link to="/auth?mode=login">Log in</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {!token && <p>Open your reset link, or request another below.</p>}
          <label className="form-field">
            <span>New password</span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button className="button button--dark" disabled={busy || !token}>
            Save new password
          </button>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
      <Link to="/auth/forgot-password">Request another reset link</Link>
    </AccountShell>
  )
}

export function InvitationPage() {
  const { user, loading, apiFetch, refreshAuth } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => readToken(location.hash))
  const [invite, setInvite] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    apiFetch('/api/invitations/preview', { method: 'POST', body: JSON.stringify({ token }) })
      .then((data) => {
        if (active) setInvite(data)
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [apiFetch, token])
  async function accept() {
    setBusy(true)
    try {
      const result = await apiFetch('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      await refreshAuth(result.organizationId)
      navigate('/employers/team', { replace: true })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  const from = `${location.pathname}${location.hash}`
  return (
    <AccountShell title={invite ? `Join ${invite.companyName}` : 'Your team invitation'}>
      {invite && (
        <>
          <p>
            This invite is for {invite.email}, with the {invite.role} role.
          </p>
          {loading ? (
            <p>Checking your account...</p>
          ) : !user ? (
            <>
              <Link className="button button--dark" to="/auth?mode=login" state={{ from }}>
                Log in
              </Link>
              <Link to="/auth?mode=signup" state={{ from }}>
                Create an account
              </Link>
            </>
          ) : !user.emailVerified ? (
            <Link to="/account" state={{ from }}>
              Verify your email first
            </Link>
          ) : user.email !== invite.email ? (
            <p>Log out and sign in with {invite.email} to accept.</p>
          ) : (
            <button className="button button--dark" disabled={busy} onClick={accept}>
              Join company
            </button>
          )}
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </AccountShell>
  )
}
