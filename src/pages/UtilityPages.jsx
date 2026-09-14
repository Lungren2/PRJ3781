import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/ProductUI.jsx'
import { useToast } from '../components/ToastContext.jsx'

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState(requestedMode)
  const toast = useToast()

  useEffect(() => {
    setMode(requestedMode)
  }, [requestedMode])

  const chooseMode = (nextMode) => {
    setMode(nextMode)
    setSearchParams({ mode: nextMode }, { replace: true })
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
            Authentication is not connected. Submitted details are not sent or stored.
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
              Sign up
            </button>
          </div>
          <div>
            <p className="eyebrow">
              {mode === 'login' ? 'Welcome back' : 'Create a preview account'}
            </p>
            <h2>{mode === 'login' ? 'Log in to Morrow' : 'Start your Morrow profile'}</h2>
            <p>
              {mode === 'login'
                ? 'Continue where you left off.'
                : 'Choose your path and begin shaping your profile.'}
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              toast(`${mode === 'login' ? 'Login' : 'Sign-up'} preview complete. No data was sent.`)
            }}
          >
            {mode === 'signup' && (
              <>
                <label className="form-field form-field--with-icon">
                  <span>Full name</span>
                  <div>
                    <UserRound size={18} />
                    <input required type="text" placeholder="Your full name" />
                  </div>
                </label>
                <fieldset className="account-type">
                  <legend>I am joining as</legend>
                  <label>
                    <input type="radio" name="account-type" defaultChecked />
                    <span>Candidate</span>
                  </label>
                  <label>
                    <input type="radio" name="account-type" />
                    <span>Employer</span>
                  </label>
                </fieldset>
              </>
            )}
            <label className="form-field form-field--with-icon">
              <span>Email address</span>
              <div>
                <Mail size={18} />
                <input required type="email" placeholder="you@example.com" />
              </div>
            </label>
            <label className="form-field form-field--with-icon">
              <span>Password</span>
              <div>
                <LockKeyhole size={18} />
                <input required type="password" placeholder="At least 8 characters" minLength="8" />
              </div>
            </label>
            <button className="button button--dark" type="submit">
              {mode === 'login' ? 'Log in' : 'Create preview account'}
            </button>
          </form>
        </div>
      </section>
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
