import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, MapPin, Wallet } from 'lucide-react'
import { SkillTags } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'

// A job an employer published on Morrow, where candidates apply with their account.
export default function JobDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const toast = useToast()
  const { user, apiFetch } = useAuth()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiFetch(`/api/jobs/${id}`)
      .then((data) => { if (active) setJob(data) })
      .catch((error) => {
        if (active && error.status !== 404) toast(`Could not load job: ${error.message}`)
        if (active) setJob(null)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Reload when the job or the logged-in account changes.
  }, [id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeApplication(method, message) {
    setBusy(true)
    try {
      setJob(await apiFetch(`/api/jobs/${id}/apply`, { method }))
      toast(message)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="product-page loading-page">
        <div className="morrow-loader"></div>
        <p className="loading-text">Loading job...</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main id="main-content" className="product-page">
        <div className="page-container">
          <p>This job is not available. It may have been closed or removed.</p>
          <Link to="/jobs" className="text-action back-link">
            <ArrowLeft size={16} /> Back to jobs
          </Link>
        </div>
      </main>
    )
  }

  let applyAction = null
  if (!user) {
    applyAction = (
      <Link className="button button--dark" to="/auth?mode=login" state={{ from: location.pathname }}>
        Log in to apply
      </Link>
    )
  } else if (!user.emailVerified) {
    applyAction = <Link className="button button--dark" to="/account" state={{ from: location.pathname }}>Verify your email to apply</Link>
  } else if (job.viewer.canApply && job.viewer.hasApplied) {
    applyAction = (
      <button
        className="button button--outline"
        type="button"
        disabled={busy}
        onClick={() => changeApplication('DELETE', 'Your application was withdrawn.')}
      >
        {busy ? 'Withdrawing...' : 'Applied ✓ - Withdraw'}
      </button>
    )
  } else if (job.viewer.canApply) {
    applyAction = (
      <button
        className={`button ${job.applicationsOpen ? 'button--dark' : 'button--outline'}`}
        type="button"
        disabled={busy || !job.applicationsOpen}
        onClick={() => changeApplication('POST', 'Application submitted. The employer can now see your profile and resume.')}
      >
        {!job.applicationsOpen ? 'No longer accepting applications' : busy ? 'Applying...' : 'Apply for this job'}
      </button>
    )
  }

  return (
    <main id="main-content" className="product-page">
      <section className="project-hero">
        <div className="page-container">
          <Link to="/jobs" className="text-action back-link">
            <ArrowLeft size={16} /> Back to jobs
          </Link>
          <p className="eyebrow">{job.company}</p>
          <h1>{job.title}</h1>
          <div className="project-row__meta hero-meta">
            <span>
              <MapPin size={15} /> {job.location} - {job.workSetup}
            </span>
            <span>
              <BriefcaseBusiness size={15} /> {job.type}
            </span>
            {job.pay && (
              <span>
                <Wallet size={15} /> {job.pay}
              </span>
            )}
            {job.publishedAt && (
              <span>
                <CalendarDays size={15} /> Posted {new Date(job.publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="page-container project-detail-section">
        <div className="project-detail-card">
          <h2>About the opportunity</h2>
          <p className="project-description job-detail__description">{job.description}</p>
          {job.skills.length > 0 && (
            <>
              <hr className="project-divider" />
              <h3>Useful skills</h3>
              <SkillTags skills={job.skills} />
            </>
          )}
          <div className="project-footer">
            {user?.isCandidate && !job.viewer.hasApplied && job.applicationsOpen && (
              <p>
                Applying shares your name, email and <Link to="/candidates/resume">saved resume</Link> with{' '}
                {job.company}.
              </p>
            )}
            {applyAction}
          </div>
        </div>
      </section>
    </main>
  )
}
