import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Compass,
  FileQuestion,
  FileText,
  GraduationCap,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  PageIntro,
  PreviewNotice,
  ProgressBar,
  RouteList,
  StatusPill,
} from '../components/ProductUI.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { useAuth } from '../components/AuthContext.jsx'

const candidateRoutes = [
  {
    to: '/candidates/resume',
    title: 'Upload your resume',
    description: 'Add a resume and answer a few quick questions to prepare future recommendations.',
    meta: 'About 5 minutes',
    icon: FileText,
  },
  {
    to: '/jobs/recommended',
    title: 'See recommended jobs',
    description: 'Preview the matching experience based on sample preferences and resume signals.',
    meta: '8 sample matches',
    icon: Sparkles,
  },
  {
    to: '/portfolio-builder',
    title: 'Build a portfolio page',
    description: 'Shape projects, education, and experience into a shareable profile shell.',
    meta: '3 sections',
    icon: Compass,
  },
  {
    to: '/projects',
    title: 'Join a practical project',
    description: 'Find small briefs from departments and external organisations.',
    meta: '4 sample briefs',
    icon: BriefcaseBusiness,
  },
]

export function CandidateHubPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="For candidates"
        title="Build your next move."
        copy="A focused workspace for finding opportunities, showing what you can do, and building useful experience."
        tone="sage"
      >
        <Link className="button button--dark" to="/jobs">
          Browse active jobs
        </Link>
      </PageIntro>

      <div className="page-container">
        <PreviewNotice />
        <section className="candidate-dashboard" aria-labelledby="candidate-next-title">
          <div className="candidate-dashboard__main">
            <div className="content-heading">
              <div>
                <p className="eyebrow">Your workspace</p>
                <h2 id="candidate-next-title">Choose your next step</h2>
              </div>
              <StatusPill tone="coral">Preview profile</StatusPill>
            </div>
            <RouteList items={candidateRoutes} />
          </div>
          <aside className="path-panel" aria-labelledby="browse-path-title">
            <p className="eyebrow">Browse by path</p>
            <h2 id="browse-path-title">What are you looking for?</h2>
            <nav>
              <Link to="/jobs/part-time">
                <BriefcaseBusiness size={19} aria-hidden="true" />
                <span>
                  <strong>Part-time work</strong>
                  <small>Flexible work alongside studies</small>
                </span>
                <ArrowRight size={17} />
              </Link>
              <Link to="/jobs/internships">
                <GraduationCap size={19} aria-hidden="true" />
                <span>
                  <strong>Internships</strong>
                  <small>Structured early experience</small>
                </span>
                <ArrowRight size={17} />
              </Link>
              <Link to="/jobs/entry-level">
                <Sparkles size={19} aria-hidden="true" />
                <span>
                  <strong>Entry-level jobs</strong>
                  <small>Your first full-time role</small>
                </span>
                <ArrowRight size={17} />
              </Link>
            </nav>
          </aside>
        </section>
      </div>
    </main>
  )
}

const MAX_RESUME_BYTES = 10 * 1024 * 1024
const RESUME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
const PROFILE_FIELDS = ['studyLevel', 'institution', 'fieldOfStudy', 'graduationYear', 'roles', 'workSetup']
const EMPTY_PROFILE = {
  studyLevel: '',
  institution: '',
  fieldOfStudy: '',
  graduationYear: '',
  roles: '',
  workSetup: 'Flexible',
}

function resumeTypeFor(file) {
  return RESUME_TYPES[file.name.split('.').pop()?.toLowerCase()] ?? null
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

export function ResumePage() {
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [visibleToEmployers, setVisibleToEmployers] = useState(false)
  const [savedFile, setSavedFile] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const toast = useToast()
  const { apiFetch } = useAuth()

  const applyResume = (data) => {
    setProfile({ ...EMPTY_PROFILE, ...data.profile })
    setVisibleToEmployers(Boolean(data.visibleToEmployers))
    setSavedFile(data.file)
    setUpdatedAt(data.updatedAt)
  }

  // Load the logged-in candidate's saved resume once when the page opens.
  useEffect(() => {
    let active = true
    apiFetch('/api/candidate/resume')
      .then((data) => { if (active) applyResume(data) })
      .catch((error) => { if (active) toast(`Could not load your saved resume: ${error.message}`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectFile = (file) => {
    if (!file) return
    if (!resumeTypeFor(file)) {
      toast('Please choose a PDF, DOC, or DOCX file.')
      return
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast('Your resume must be 10MB or smaller.')
      return
    }
    setPendingFile(file)
  }

  const removeFile = async () => {
    if (pendingFile) {
      setPendingFile(null)
      return
    }
    try {
      await apiFetch('/api/candidate/resume/file', { method: 'DELETE' })
      setSavedFile(null)
      toast('Resume file removed.')
    } catch (error) {
      toast(`Could not remove resume file: ${error.message}`)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (pendingFile) {
        applyResume(await apiFetch('/api/candidate/resume/file', {
          method: 'PUT',
          headers: {
            'content-type': resumeTypeFor(pendingFile),
            'x-file-name': encodeURIComponent(pendingFile.name),
          },
          body: pendingFile,
        }))
        setPendingFile(null)
      }
      applyResume(await apiFetch('/api/candidate/resume', {
        method: 'PUT',
        body: JSON.stringify({ profile, visibleToEmployers }),
      }))
      toast('Resume saved to your account.')
    } catch (error) {
      toast(`Could not save resume: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
  }
  const shownFile = pendingFile ? { fileName: pendingFile.name, size: pendingFile.size } : savedFile
  const answered = PROFILE_FIELDS.filter((field) => profile[field]).length
  const readiness = Math.round((((shownFile ? 1 : 0) + answered) / (PROFILE_FIELDS.length + 1)) * 100)
  const currentStep = !shownFile ? 1 : answered < PROFILE_FIELDS.length ? 2 : 3

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Candidate profile"
        title="Make your resume work harder."
        copy="Add a resume and a little context. Future matching will use this to surface more relevant roles."
      >
        <StatusPill tone="blue">{updatedAt ? `Last saved ${formatDate(updatedAt)}` : 'Not saved yet'}</StatusPill>
      </PageIntro>

      <div className="page-container resume-layout">
        <aside className="resume-steps" aria-label="Resume setup steps">
          <p className="eyebrow">Setup progress</p>
          <ProgressBar value={readiness} label="Profile readiness" />
          <ol>
            <li className={currentStep === 1 ? 'is-current' : undefined}>
              <span>1</span>
              <div>
                <strong>Resume</strong>
                <small>Upload a PDF or Word file</small>
              </div>
            </li>
            <li className={currentStep === 2 ? 'is-current' : undefined}>
              <span>2</span>
              <div>
                <strong>Quick questions</strong>
                <small>Add preferences</small>
              </div>
            </li>
            <li className={currentStep === 3 ? 'is-current' : undefined}>
              <span>3</span>
              <div>
                <strong>Review</strong>
                <small>Check and save your profile</small>
              </div>
            </li>
          </ol>
        </aside>

        <form className="resume-form form-surface" onSubmit={save} aria-busy={loading || saving}>
          <PreviewNotice>
            Your resume and answers are saved to your candidate account. Employers can only see them if you allow it in step 3.
          </PreviewNotice>
          <section aria-labelledby="resume-upload-title">
            <div className="form-section-heading">
              <span className="step-icon">
                <UploadCloud size={20} />
              </span>
              <div>
                <p>Step 1</p>
                <h2 id="resume-upload-title">Add your resume</h2>
              </div>
            </div>
            <div
              className={`drop-zone${dragActive ? ' drop-zone--active' : ''}${shownFile ? ' drop-zone--selected' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragActive(false)
                selectFile(event.dataTransfer.files[0])
              }}
            >
              {shownFile ? (
                <Check size={28} aria-hidden="true" />
              ) : (
                <UploadCloud size={28} aria-hidden="true" />
              )}
              <h3>{loading ? 'Loading your resume…' : shownFile?.fileName || 'Drag and drop your resume here'}</h3>
              <p>
                {pendingFile
                  ? `${formatBytes(pendingFile.size)} - uploads when you save`
                  : savedFile
                    ? `${formatBytes(savedFile.size)} - uploaded ${formatDate(savedFile.uploadedAt)}`
                    : 'PDF, DOC, or DOCX, up to 10MB'}
              </p>
              <label className="button button--outline" htmlFor="resume-file">
                {shownFile ? 'Choose another file' : 'Choose a file'}
              </label>
              <input
                className="sr-only"
                id="resume-file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => {
                  selectFile(event.target.files[0])
                  event.target.value = ''
                }}
              />
              {shownFile && (
                <div className="form-actions">
                  {savedFile && !pendingFile && (
                    <a className="button button--outline" href="/api/candidate/resume/file">
                      Download
                    </a>
                  )}
                  <button className="button button--outline" type="button" onClick={removeFile}>
                    {pendingFile ? 'Cancel selection' : 'Remove file'}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="quick-questions-title">
            <div className="form-section-heading">
              <span className="step-icon">
                <FileQuestion size={20} />
              </span>
              <div>
                <p>Step 2</p>
                <h2 id="quick-questions-title">Answer a few quick questions</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Current study level</span>
                <select name="studyLevel" value={profile.studyLevel} onChange={updateField}>
                  <option value="" disabled>
                    Select a level
                  </option>
                  <option>Undergraduate</option>
                  <option>Postgraduate</option>
                  <option>Recent graduate</option>
                </select>
              </label>
              <label className="form-field">
                <span>Institution</span>
                <input
                  name="institution"
                  type="text"
                  maxLength={120}
                  placeholder="Your university or college"
                  value={profile.institution}
                  onChange={updateField}
                />
              </label>
              <label className="form-field">
                <span>Field of study</span>
                <input
                  name="fieldOfStudy"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Information Systems"
                  value={profile.fieldOfStudy}
                  onChange={updateField}
                />
              </label>
              <label className="form-field">
                <span>Graduation year</span>
                <select name="graduationYear" value={profile.graduationYear} onChange={updateField}>
                  <option value="" disabled>
                    Select a year
                  </option>
                  <option>2026</option>
                  <option>2027</option>
                  <option>2028</option>
                  <option>Already graduated</option>
                </select>
              </label>
              <label className="form-field form-field--wide">
                <span>What roles interest you?</span>
                <input
                  name="roles"
                  type="text"
                  maxLength={300}
                  placeholder="e.g. product design, data, marketing"
                  value={profile.roles}
                  onChange={updateField}
                />
              </label>
              <label className="form-field form-field--wide">
                <span>Preferred work setup</span>
                <select name="workSetup" value={profile.workSetup} onChange={updateField}>
                  <option>Flexible</option>
                  <option>On-site</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </label>
            </div>
          </section>

          <section aria-labelledby="resume-review-title">
            <div className="form-section-heading">
              <span className="step-icon">
                <FileText size={20} />
              </span>
              <div>
                <p>Step 3</p>
                <h2 id="resume-review-title">Review</h2>
              </div>
            </div>
            <p>
              {shownFile ? `Resume: ${shownFile.fileName}.` : 'No resume file added yet.'}{' '}
              {answered} of {PROFILE_FIELDS.length} questions answered.
              {pendingFile ? ' Save to upload your new file.' : ''}
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={visibleToEmployers}
                onChange={(event) => setVisibleToEmployers(event.target.checked)}
              />
              <span>Let employers on Morrow see my profile, email, and resume</span>
            </label>
          </section>

          <div className="form-actions">
            <Link className="button button--outline" to="/candidates">
              Back to candidate home
            </Link>
            <button className="button button--dark" type="submit" disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save resume'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
