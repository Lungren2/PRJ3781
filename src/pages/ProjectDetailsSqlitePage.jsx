import { useEffect, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Clock3 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'

export default function ProjectDetailsSqlitePage() {
  const { id } = useParams()
  const { user, apiFetch } = useAuth()
  const toast = useToast()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    apiFetch('/api/product-requests/' + id)
      .then(setProject)
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [apiFetch, id])

  async function handleApply() {
    try {
      setApplying(true)
      const updatedProject = await apiFetch('/api/product-requests/' + id + '/assign', {
        method: 'PUT',
      })
      setProject(updatedProject)
      toast('Application submitted successfully.')
    } catch (error) {
      console.error(error)
      toast(error.message || 'Could not submit application.')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <main className="product-page loading-page">
        <div className="morrow-loader" />
        <p className="loading-text">Loading project...</p>
      </main>
    )
  }

  if (!project) {
    return (
      <main className="product-page">
        <p>Project not found.</p>
      </main>
    )
  }

  const hasApplied = Boolean(project.hasApplied)
  const deadlinePassed =
    project.deadline && String(project.deadline).slice(0, 10) < new Date().toISOString().slice(0, 10)
  const applicationsClosed = project.status !== 'Open' || deadlinePassed
  const applicantCount = project.applicantCount ?? project.assignedStudents?.length ?? 0

  return (
    <main className="product-page">
      <section className="project-hero">
        <div className="page-container">
          <Link to="/projects" className="text-action back-link">
            <ArrowLeft size={16} />
            Back to Projects
          </Link>

          <p className="eyebrow">{project.companyName}</p>
          <h1>{project.title}</h1>

          <div className="project-row__meta hero-meta">
            <span>
              <BriefcaseBusiness size={15} />
              {project.department}
            </span>
            <span>
              <Clock3 size={15} />
              {project.category}
            </span>
            <span>
              <CalendarDays size={15} />
              {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}
            </span>
          </div>
        </div>
      </section>

      <section className="page-container project-detail-section">
        <div className="project-detail-card">
          <h2>Project Overview</h2>
          <p className="project-description">{project.description}</p>

          <hr className="project-divider" />

          <div className="project-info-grid">
            <div className="info-card">
              <span className="deadline-label">Application deadline</span>
              <strong>
                {project.deadline
                  ? new Date(project.deadline).toLocaleDateString()
                  : 'No deadline'}
              </strong>
            </div>
            <div className="info-card">
              <span className="deadline-label">Applicants</span>
              <strong>{applicantCount}</strong>
            </div>
          </div>

          {Array.isArray(project.assignedStudents) && (
            <div className="applications-panel">
              <div className="applications-panel__header">
                <div>
                  <h3>Applications</h3>
                  <p>
                    {applicantCount} student{applicantCount !== 1 ? 's' : ''} applied
                  </p>
                </div>
              </div>

              {project.assignedStudents.length > 0 ? (
                <div className="applicant-list">
                  {project.assignedStudents.map((student, index) => (
                    <div className="applicant-row" key={student.id || student}>
                      <div className="applicant-avatar">
                        {student.name ? student.name.charAt(0).toUpperCase() : index + 1}
                      </div>
                      <div className="applicant-info">
                        <strong>{student.name || 'Applicant'}</strong>
                        <span>{student.email || 'Student account'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-applications">No applications yet.</p>
              )}
            </div>
          )}

          <div className="project-footer">
            <button
              className={
                'button ' +
                (hasApplied || applicationsClosed || !user?.isCandidate
                  ? 'button--outline'
                  : 'button--dark')
              }
              onClick={handleApply}
              disabled={applying || hasApplied || applicationsClosed || !user?.isCandidate}
              type="button"
            >
              {applicationsClosed
                ? 'Applications Closed'
                : hasApplied
                  ? 'Applied'
                  : !user?.isCandidate
                    ? 'Candidate account required'
                    : applying
                      ? 'Applying...'
                      : 'Apply to Project'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
