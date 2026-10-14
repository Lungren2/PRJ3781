import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Download,
  Layers3,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageIntro, PreviewNotice, SkillTags, StatusPill } from '../components/ProductUI.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { useAuth } from '../components/AuthContext.jsx'

const employerServices = [
  {
    icon: Users,
    number: '01',
    title: 'Top-rated talent sourcing and screening',
    copy: 'Preview a focused pipeline of students and graduates, then shape shortlists around role requirements.',
  },
  {
    icon: BarChart3,
    number: '02',
    title: 'Advanced analytics',
    copy: 'A future workspace for source quality, application progress, reach, and hiring funnel signals.',
  },
  {
    icon: CalendarDays,
    number: '03',
    title: 'Virtual events and employer branding',
    copy: 'Plan graduate showcases, information sessions, and content that gives candidates a clearer view of the work.',
  },
]

export function EmployerHubPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="For employers"
        title="Start hiring with more signal."
        copy="Meet early-career candidates in a space designed around potential, practical work, and clearer next steps."
        tone="ink"
      >
        <Link className="button button--white" to="/employers/post-job">
          Post a job
        </Link>
        <Link className="button button--ghost-light" to="/employers/candidates">
          Browse candidates
        </Link>
      </PageIntro>

      <div className="page-container">
        <PreviewNotice>
          Employer tools, analytics, events, and candidate profiles are interface previews only.
        </PreviewNotice>
        <section className="hiring-services" aria-labelledby="hiring-services-title">
          <div className="hiring-services__intro">
            <p className="eyebrow">Hiring workspace</p>
            <h2 id="hiring-services-title">Built for the early-career market.</h2>
            <p>
              Start with a clear role. Find emerging talent. Build a useful candidate experience
              around it.
            </p>
          </div>
          <div className="service-list">
            {employerServices.map(({ icon: Icon, number, title, copy }) => (
              <article key={number}>
                <span>{number}</span>
                <Icon size={24} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="employer-cta" aria-labelledby="employer-cta-title">
          <div>
            <p className="eyebrow">Ready to shape a role?</p>
            <h2 id="employer-cta-title">Create a clear job brief in a few steps.</h2>
          </div>
          <Link className="button button--dark" to="/employers/post-job">
            Start a job draft <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </main>
  )
}

const WORK_SETUP_FILTERS = ['All setups', 'Flexible', 'On-site', 'Hybrid', 'Remote']

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function rolesFor(profile) {
  return (profile.roles ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 5)
}

export function BrowseCandidatesPage() {
  const [query, setQuery] = useState('')
  const [workSetup, setWorkSetup] = useState('All setups')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { activeOrganization: organization, apiFetch } = useAuth()
  const canBrowseCandidates = organization.canBrowseCandidates === true
  const candidatesPath = `/api/organizations/${organization.id}/candidates`

  const search = useCallback(
    async (filters = {}) => {
      if (!canBrowseCandidates) return
      const params = new URLSearchParams()
      if (filters.query) params.set('q', filters.query)
      if (filters.workSetup && filters.workSetup !== 'All setups') params.set('workSetup', filters.workSetup)
      setLoading(true)
      setLoadError('')
      try {
        const data = await apiFetch(`${candidatesPath}?${params}`)
        setCandidates(data.items)
      } catch (error) {
        setLoadError(`Could not load candidates: ${error.message}`)
      } finally {
        setLoading(false)
      }
    },
    [apiFetch, candidatesPath, canBrowseCandidates],
  )

  useEffect(() => {
    search()
  }, [search])

  if (!canBrowseCandidates) {
    return (
      <main id="main-content" className="product-page">
        <PageIntro
          eyebrow="Talent discovery"
          title="Company approval needed"
          copy="Your company needs approval before you can browse candidates and download their CVs."
        />
        <div className="page-container">
          <p>You can still post jobs and projects. Candidates who apply will share their CV with your company.</p>
          <Link className="button button--dark" to="/employers/post-job">
            Open your workspace
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Talent discovery"
        title="Browse candidates"
        copy="Search students and graduates who have chosen to share their profile with employers."
      />
      <div className="page-container candidate-browser">
        <form
          className="candidate-filters"
          onSubmit={(event) => {
            event.preventDefault()
            search({ query: query.trim(), workSetup })
          }}
        >
          <label className="form-field form-field--with-icon">
            <span>Name, field of study, institution, or role</span>
            <div>
              <Search size={18} />
              <input
                type="search"
                value={query}
                maxLength={100}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try Information Systems or data"
              />
            </div>
          </label>
          <label className="form-field">
            <span>Work setup</span>
            <select value={workSetup} onChange={(event) => setWorkSetup(event.target.value)}>
              {WORK_SETUP_FILTERS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <button className="button button--dark" type="submit" disabled={loading}>
            Search talent
          </button>
        </form>
        <PreviewNotice>
          Only candidates who opted in to being seen by employers appear here. Treat their details as confidential.
        </PreviewNotice>
        <section className="candidate-list" aria-labelledby="candidate-list-title" aria-busy={loading}>
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Talent pool</p>
              <h2 id="candidate-list-title">
                {loading ? 'Loading candidates…' : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`}
              </h2>
            </div>
            <StatusPill tone="sage">{organization.name}</StatusPill>
          </div>
          {loadError && <p role="alert">{loadError}</p>}
          {!loading && !loadError && candidates.length === 0 && (
            <p>No candidates match yet. Try a broader search, or check back as more candidates share their profiles.</p>
          )}
          {candidates.map((candidate) => {
            const { profile } = candidate
            const roles = rolesFor(profile)
            return (
              <article className="candidate-row" key={candidate.id}>
                <div className="candidate-avatar" aria-hidden="true">
                  {initialsFor(candidate.displayName)}
                </div>
                <div className="candidate-row__identity">
                  <h3>{candidate.displayName}</h3>
                  <p>{[profile.fieldOfStudy, profile.studyLevel].filter(Boolean).join(' · ') || 'Field of study not added'}</p>
                  <span>{profile.institution || 'Institution not added'}</span>
                </div>
                <div className="candidate-row__details">
                  <strong>{profile.workSetup || 'Flexible'}</strong>
                  <span>
                    {profile.graduationYear
                      ? profile.graduationYear === 'Already graduated'
                        ? 'Graduated'
                        : `Graduating ${profile.graduationYear}`
                      : 'Graduation year not added'}
                  </span>
                  {roles.length > 0 && <SkillTags skills={roles} />}
                </div>
                <div className="candidate-row__actions">
                  {candidate.hasResumeFile && (
                    <a className="text-action" href={`${candidatesPath}/${candidate.id}/resume`}>
                      Resume <Download size={16} aria-hidden="true" />
                    </a>
                  )}
                  <a className="text-action" href={`mailto:${candidate.email}`}>
                    Email <Mail size={16} aria-hidden="true" />
                  </a>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}

const EMPTY_JOB = {
  title: '',
  type: 'Internship',
  location: '',
  workSetup: 'Hybrid',
  pay: '',
  description: '',
  skills: '',
}
const EMPTY_PROJECT = {
  title: '',
  department: '',
  category: 'General',
  pay: '',
  duration: '',
  deadline: '',
  description: '',
}
const PROJECT_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'UI/UX Design',
  'Data Analysis',
  'Research',
  'Marketing',
  'General',
]
const PROJECT_STATUSES = ['Open', 'In Progress', 'Completed']
const JOB_STATUS_LABELS = { draft: 'Draft', published: 'Published', closed: 'Closed' }
const STATUS_TONES = {
  draft: 'blue',
  published: 'sage',
  closed: 'coral',
  Open: 'sage',
  'In Progress': 'blue',
  Completed: 'coral',
}

function jobToForm(job) {
  return {
    title: job.title,
    type: job.type,
    location: job.location,
    workSetup: job.workSetup,
    pay: job.pay,
    description: job.description,
    skills: job.skills.join(', '),
  }
}

function projectToForm(project) {
  return {
    title: project.title,
    department: project.department,
    category: project.category,
    pay: project.pay,
    duration: project.duration,
    deadline: project.deadline ? project.deadline.slice(0, 10) : '',
    description: project.description,
  }
}

const APPLICANT_STATUS_LABELS = {
  applied: 'Applied',
  selected: 'Selected',
  completed: 'Completed (shows on portfolio)',
  declined: 'Declined',
}

function ApplicantList({ applicants, resumePath, onStatusChange, busy }) {
  if (applicants.length === 0) return <p className="no-applications">No applications yet.</p>
  return (
    <div className="applicant-list">
      {applicants.map((applicant) => (
        <div className="applicant-row" key={applicant.id}>
          <div className="applicant-avatar">{applicant.name.charAt(0).toUpperCase()}</div>
          <div className="applicant-info">
            <strong>{applicant.name}</strong>
            <span>
              <a href={`mailto:${applicant.email}`}>{applicant.email}</a>
              {` · applied ${new Date(applicant.appliedAt).toLocaleDateString()}`}
            </span>
          </div>
          {onStatusChange && (
            <label className="compact-select">
              <span className="sr-only">Status for {applicant.name}</span>
              <select
                value={applicant.status ?? 'applied'}
                disabled={busy}
                onChange={(event) => onStatusChange(applicant.id, event.target.value)}
              >
                {Object.entries(APPLICANT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {applicant.hasResumeFile && (
            <a className="text-action" href={resumePath(applicant.id)}>
              Resume <Download size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

export function PostJobPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = searchParams.get('kind') === 'project' ? 'project' : 'job'
  const [jobForm, setJobForm] = useState(EMPTY_JOB)
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT)
  const [editing, setEditing] = useState(null)
  const [jobs, setJobs] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [openApplicants, setOpenApplicants] = useState(null)
  const toast = useToast()
  const { activeOrganization: organization, apiFetch } = useAuth()
  const canEdit = organization.role === 'owner' || organization.role === 'recruiter'
  const jobsPath = `/api/organizations/${organization.id}/jobs`
  const projectsPath = `/api/organizations/${organization.id}/product-requests`
  const editingJob = editing?.kind === 'job' ? jobs.find((job) => job.id === editing.id) : null
  const editingProject = editing?.kind === 'project' ? projects.find((project) => project.id === editing.id) : null

  useEffect(() => {
    let active = true
    Promise.all([apiFetch(jobsPath), apiFetch(projectsPath)])
      .then(([jobData, projectData]) => {
        if (!active) return
        setJobs(jobData)
        setProjects(projectData)
      })
      .catch((error) => { if (active) toast(`Could not load your postings: ${error.message}`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, jobsPath, projectsPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const setKind = (next) => {
    setEditing(null)
    setSearchParams(next === 'project' ? { kind: 'project' } : {}, { replace: true })
  }

  const upsert = (setList, item) => setList((current) => [item, ...current.filter((entry) => entry.id !== item.id)])

  const resetForms = () => {
    setJobForm(EMPTY_JOB)
    setProjectForm(EMPTY_PROJECT)
    setEditing(null)
  }

  async function run(action, successMessage) {
    setBusy(true)
    try {
      const result = await action()
      if (successMessage) toast(successMessage)
      return result
    } catch (error) {
      toast(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  // Jobs: save as a new draft or as changes to the job being edited, optionally publishing.
  const saveJob = (publish) =>
    run(async () => {
      let job
      if (editingJob) {
        job = await apiFetch(`${jobsPath}/${editingJob.id}`, { method: 'PATCH', body: JSON.stringify({ job: jobForm }) })
        if (publish && job.status !== 'published') {
          job = await apiFetch(`${jobsPath}/${editingJob.id}/publish`, { method: 'POST' })
        }
      } else {
        job = await apiFetch(jobsPath, { method: 'POST', body: JSON.stringify({ job: jobForm, publish }) })
      }
      upsert(setJobs, job)
      resetForms()
    }, publish ? 'Job published. Candidates can now see it on the Jobs page.' : 'Job saved.')

  // Projects go live as soon as they are posted.
  const saveProject = () =>
    run(async () => {
      const project = editingProject
        ? await apiFetch(`/api/product-requests/${editingProject.id}`, { method: 'PUT', body: JSON.stringify(projectForm) })
        : await apiFetch('/api/product-requests', {
            method: 'POST',
            body: JSON.stringify({ ...projectForm, organizationId: organization.id }),
          })
      upsert(setProjects, project)
      resetForms()
    }, editingProject ? 'Project updated.' : 'Project posted. Candidates can now apply on the Projects page.')

  const changeJobStatus = (job, action) =>
    run(async () => {
      upsert(setJobs, await apiFetch(`${jobsPath}/${job.id}/${action}`, { method: 'POST' }))
    }, action === 'close' ? `"${job.title}" closed.` : `"${job.title}" published.`)

  const changeApplicantStatus = (project, userId, status) =>
    run(async () => {
      upsert(
        setProjects,
        await apiFetch(`${projectsPath}/${project.id}/applicants/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        }),
      )
    }, status === 'completed' ? 'Marked as completed. It now shows on their portfolio.' : 'Applicant updated.')

  const changeProjectStatus = (project, status) =>
    run(async () => {
      upsert(
        setProjects,
        await apiFetch(`/api/product-requests/${project.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
      )
    }, `"${project.title}" is now ${status}.`)

  const remove = (kindToRemove, item) => {
    if (!window.confirm(`Delete "${item.title || 'Untitled'}"? This cannot be undone.`)) return
    const path = kindToRemove === 'job' ? `${jobsPath}/${item.id}` : `/api/product-requests/${item.id}`
    const setList = kindToRemove === 'job' ? setJobs : setProjects
    run(async () => {
      await apiFetch(path, { method: 'DELETE' })
      setList((current) => current.filter((entry) => entry.id !== item.id))
      if (editing?.id === item.id) resetForms()
    }, 'Deleted.')
  }

  const edit = (kindToEdit, item) => {
    setSearchParams(kindToEdit === 'project' ? { kind: 'project' } : {}, { replace: true })
    if (kindToEdit === 'job') setJobForm(jobToForm(item))
    else setProjectForm(projectToForm(item))
    setEditing({ kind: kindToEdit, id: item.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateJobField = (event) => {
    const { name, value } = event.target
    setJobForm((current) => ({ ...current, [name]: value }))
  }
  const updateProjectField = (event) => {
    const { name, value } = event.target
    setProjectForm((current) => ({ ...current, [name]: value }))
  }

  const form = kind === 'job' ? jobForm : projectForm
  const previewSkills = jobForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 6)
  const editingItem = editingJob || editingProject

  let notice
  if (!canEdit) notice = 'You have view-only access to this organisation. Ask an owner or recruiter to post.'
  else if (editingJob) {
    notice = `Editing job "${editingJob.title || 'Untitled job'}" (${JOB_STATUS_LABELS[editingJob.status]}).${editingJob.status === 'published' ? ' Changes are visible to candidates as soon as you save.' : ''}`
  } else if (editingProject) notice = `Editing project "${editingProject.title}". Changes are visible to candidates as soon as you save.`
  else if (kind === 'job') notice = 'A fixed role. Save a draft to finish later, or publish it to the Jobs page. A title, location and description are needed to publish.'
  else notice = 'A short, scoped piece of work students can do, paid or unpaid. It goes live on the Projects page as soon as you post it.'

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Employer workspace"
        title={kind === 'job' ? 'Post a job' : 'Post a paid project'}
        copy="Post a fixed role, or a short paid project students can take on alongside their studies."
        tone="sage"
      >
        <StatusPill tone="blue">{organization.name}</StatusPill>
      </PageIntro>
      <div className="page-container job-post-layout">
        <form
          className="form-surface job-post-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (kind === 'job') saveJob(false)
            else saveProject()
          }}
        >
          <div className="filter-chips" role="group" aria-label="What are you posting?">
            <button
              type="button"
              className={kind === 'job' ? 'is-active' : ''}
              aria-pressed={kind === 'job'}
              onClick={() => setKind('job')}
              disabled={Boolean(editingItem)}
            >
              Job (fixed role)
            </button>
            <button
              type="button"
              className={kind === 'project' ? 'is-active' : ''}
              aria-pressed={kind === 'project'}
              onClick={() => setKind('project')}
              disabled={Boolean(editingItem)}
            >
              Short paid project
            </button>
          </div>
          <PreviewNotice>{notice}</PreviewNotice>

          {kind === 'job' ? (
            <>
              <section aria-labelledby="role-basics-title">
                <div className="form-section-heading">
                  <span className="step-icon">
                    <BriefcaseBusiness size={20} />
                  </span>
                  <div>
                    <p>Step 1</p>
                    <h2 id="role-basics-title">Role basics</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="form-field form-field--wide">
                    <span>Job title</span>
                    <input name="title" required maxLength={120} type="text" value={jobForm.title} onChange={updateJobField} placeholder="e.g. Junior Data Analyst" />
                  </label>
                  <label className="form-field">
                    <span>Opportunity type</span>
                    <select name="type" value={jobForm.type} onChange={updateJobField}>
                      <option>Internship</option>
                      <option>Part-time</option>
                      <option>Entry level</option>
                      <option>Graduate programme</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Location</span>
                    <input name="location" maxLength={80} type="text" value={jobForm.location} onChange={updateJobField} placeholder="City or remote" />
                  </label>
                  <label className="form-field">
                    <span>Work setup</span>
                    <select name="workSetup" value={jobForm.workSetup} onChange={updateJobField}>
                      <option>On-site</option>
                      <option>Hybrid</option>
                      <option>Remote</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Pay or stipend</span>
                    <input name="pay" maxLength={60} type="text" value={jobForm.pay} onChange={updateJobField} placeholder="e.g. R9 000 / month" />
                  </label>
                </div>
              </section>
              <section aria-labelledby="role-detail-title">
                <div className="form-section-heading">
                  <span className="step-icon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <p>Step 2</p>
                    <h2 id="role-detail-title">Role details</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="form-field form-field--wide">
                    <span>What will this person work on?</span>
                    <textarea name="description" rows="6" maxLength={5000} value={jobForm.description} onChange={updateJobField} placeholder="Describe the work, team, and a typical first project." />
                  </label>
                  <label className="form-field form-field--wide">
                    <span>Useful skills (comma separated)</span>
                    <input name="skills" type="text" value={jobForm.skills} onChange={updateJobField} placeholder="e.g. Excel, SQL, clear communication" />
                  </label>
                </div>
              </section>
            </>
          ) : (
            <>
              <section aria-labelledby="project-basics-title">
                <div className="form-section-heading">
                  <span className="step-icon">
                    <Layers3 size={20} />
                  </span>
                  <div>
                    <p>Step 1</p>
                    <h2 id="project-basics-title">Project basics</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="form-field form-field--wide">
                    <span>Project title</span>
                    <input name="title" required maxLength={120} type="text" value={projectForm.title} onChange={updateProjectField} placeholder="e.g. Landing page for our open day" />
                  </label>
                  <label className="form-field">
                    <span>Field or department</span>
                    <input name="department" required maxLength={80} type="text" value={projectForm.department} onChange={updateProjectField} placeholder="e.g. Information Systems" />
                  </label>
                  <label className="form-field">
                    <span>Category</span>
                    <select name="category" value={projectForm.category} onChange={updateProjectField}>
                      {PROJECT_CATEGORIES.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Payment</span>
                    <input name="pay" maxLength={60} type="text" value={projectForm.pay} onChange={updateProjectField} placeholder="e.g. R3 000 fixed (leave empty if unpaid)" />
                  </label>
                  <label className="form-field">
                    <span>Expected duration</span>
                    <input name="duration" maxLength={60} type="text" value={projectForm.duration} onChange={updateProjectField} placeholder="e.g. 2 weeks" />
                  </label>
                  <label className="form-field">
                    <span>Application deadline</span>
                    <input
                      name="deadline"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={projectForm.deadline}
                      onChange={updateProjectField}
                    />
                  </label>
                </div>
              </section>
              <section aria-labelledby="project-detail-title">
                <div className="form-section-heading">
                  <span className="step-icon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <p>Step 2</p>
                    <h2 id="project-detail-title">What needs to be done?</h2>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="form-field form-field--wide">
                    <span>Brief</span>
                    <textarea name="description" required rows="6" maxLength={4000} value={projectForm.description} onChange={updateProjectField} placeholder="Describe the deliverable, what you will provide, and how the work will be handed over." />
                  </label>
                </div>
              </section>
            </>
          )}

          <div className="form-actions">
            {editingItem ? (
              <button className="button button--outline" type="button" onClick={resetForms} disabled={busy}>
                Cancel editing
              </button>
            ) : (
              <Link className="button button--outline" to="/employers">
                Back to employers
              </Link>
            )}
            {canEdit && kind === 'job' && (
              <>
                <button className="button button--outline" type="submit" disabled={busy}>
                  {editingJob?.status === 'published' ? 'Save changes' : 'Save draft'}
                </button>
                {editingJob?.status !== 'published' && (
                  <button className="button button--dark" type="button" onClick={() => saveJob(true)} disabled={busy}>
                    {editingJob ? 'Save & publish' : 'Publish job'}
                  </button>
                )}
              </>
            )}
            {canEdit && kind === 'project' && (
              <button className="button button--dark" type="submit" disabled={busy}>
                {editingProject ? 'Save changes' : 'Post project'}
              </button>
            )}
          </div>
        </form>
        <aside className="job-preview" aria-labelledby="job-preview-title">
          <div>
            <ShieldCheck size={22} />
            <span>Candidate view preview</span>
          </div>
          <p className="eyebrow">{kind === 'job' ? jobForm.type : `Paid project · ${projectForm.category}`}</p>
          <h2 id="job-preview-title">{form.title || (kind === 'job' ? 'Your job title' : 'Your project title')}</h2>
          <p>{organization.name}</p>
          <span>
            {kind === 'job'
              ? `${jobForm.location || 'Location'} - ${jobForm.workSetup}${jobForm.pay ? ` - ${jobForm.pay}` : ''}`
              : [projectForm.pay || 'Unpaid', projectForm.duration, projectForm.deadline && `apply by ${new Date(projectForm.deadline).toLocaleDateString()}`]
                  .filter(Boolean)
                  .join(' - ')}
          </span>
          <hr />
          <h3>{kind === 'job' ? 'About the opportunity' : 'The brief'}</h3>
          <p className="job-preview__description">
            {form.description || 'Your description will preview here as you write it.'}
          </p>
          {kind === 'job' && previewSkills.length > 0 && <SkillTags skills={previewSkills} />}
        </aside>
      </div>

      <section className="page-container employer-jobs" aria-labelledby="employer-jobs-title">
        <div className="results-toolbar">
          <div>
            <p className="eyebrow">Your organisation</p>
            <h2 id="employer-jobs-title">Your postings</h2>
          </div>
        </div>
        {loading && <p>Loading your postings…</p>}
        {!loading && jobs.length === 0 && projects.length === 0 && (
          <p>Nothing posted yet. Saved drafts, published jobs and projects will appear here.</p>
        )}

        {jobs.length > 0 && <h3>Jobs</h3>}
        {jobs.map((job) => (
          <article className="employer-job" key={job.id}>
            <div className="employer-job__summary">
              <div>
                <h3>{job.title || 'Untitled job'}</h3>
                <p>
                  {[job.type, job.location, job.workSetup].filter(Boolean).join(' · ')}
                  {job.status === 'published' && job.publishedAt
                    ? ` · published ${new Date(job.publishedAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <StatusPill tone={STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</StatusPill>
            </div>
            <div className="employer-job__actions">
              <button
                className="text-action"
                type="button"
                aria-expanded={openApplicants === job.id}
                onClick={() => setOpenApplicants(openApplicants === job.id ? null : job.id)}
              >
                <Users size={16} aria-hidden="true" /> {job.applicantCount} applicant{job.applicantCount === 1 ? '' : 's'}
              </button>
              {job.status === 'published' && (
                <Link className="text-action" to={`/jobs/posted/${job.id}`}>
                  View listing <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {canEdit && (
                <>
                  <button className="text-action" type="button" onClick={() => edit('job', job)} disabled={busy}>
                    Edit
                  </button>
                  {job.status === 'published' ? (
                    <button className="text-action" type="button" onClick={() => changeJobStatus(job, 'close')} disabled={busy}>
                      Close
                    </button>
                  ) : (
                    <button className="text-action" type="button" onClick={() => changeJobStatus(job, 'publish')} disabled={busy}>
                      {job.status === 'closed' ? 'Reopen' : 'Publish'}
                    </button>
                  )}
                  <button className="text-action" type="button" onClick={() => remove('job', job)} disabled={busy}>
                    Delete
                  </button>
                </>
              )}
            </div>
            {openApplicants === job.id && (
              <ApplicantList
                applicants={job.applicants}
                resumePath={(userId) => `${jobsPath}/${job.id}/applicants/${userId}/resume`}
              />
            )}
          </article>
        ))}

        {projects.length > 0 && <h3>Projects</h3>}
        {projects.map((project) => (
          <article className="employer-job" key={project.id}>
            <div className="employer-job__summary">
              <div>
                <h3>{project.title}</h3>
                <p>
                  {[
                    project.category,
                    project.pay || 'Unpaid',
                    project.duration,
                    project.deadline && `apply by ${new Date(project.deadline).toLocaleDateString()}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <StatusPill tone={STATUS_TONES[project.status]}>{project.status}</StatusPill>
            </div>
            <div className="employer-job__actions">
              <button
                className="text-action"
                type="button"
                aria-expanded={openApplicants === project.id}
                onClick={() => setOpenApplicants(openApplicants === project.id ? null : project.id)}
              >
                <Users size={16} aria-hidden="true" /> {project.applicantCount} applicant{project.applicantCount === 1 ? '' : 's'}
              </button>
              <Link className="text-action" to={`/projects/${project.id}`}>
                View project <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {canEdit && (
                <>
                  <button className="text-action" type="button" onClick={() => edit('project', project)} disabled={busy}>
                    Edit
                  </button>
                  <label className="compact-select">
                    <span className="sr-only">Status of {project.title}</span>
                    <select
                      value={project.status}
                      onChange={(event) => changeProjectStatus(project, event.target.value)}
                      disabled={busy}
                    >
                      {PROJECT_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <button className="text-action" type="button" onClick={() => remove('project', project)} disabled={busy}>
                    Delete
                  </button>
                </>
              )}
            </div>
            {openApplicants === project.id && (
              <ApplicantList
                applicants={project.applicants ?? []}
                resumePath={(userId) => `${projectsPath}/${project.id}/applicants/${userId}/resume`}
                onStatusChange={canEdit ? (userId, status) => changeApplicantStatus(project, userId, status) : undefined}
                busy={busy}
              />
            )}
          </article>
        ))}
      </section>
    </main>
  )
}
