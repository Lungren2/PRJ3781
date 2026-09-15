import { useState } from 'react'
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

export function ResumePage() {
  const [fileName, setFileName] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const toast = useToast()
  const { apiFetch } = useAuth()

  const setLocalFile = (file) => {
    if (!file) return
    setFileName(file.name)
    toast(`${file.name} is selected locally. It has not been uploaded.`)
  }

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Candidate profile"
        title="Make your resume work harder."
        copy="Add a resume and a little context. Future matching will use this to surface more relevant roles."
      >
        <StatusPill tone="blue">Frontend-only flow</StatusPill>
      </PageIntro>

      <div className="page-container resume-layout">
        <aside className="resume-steps" aria-label="Resume setup steps">
          <p className="eyebrow">Setup progress</p>
          <ProgressBar value={fileName ? 50 : 20} label="Profile readiness" />
          <ol>
            <li className="is-current">
              <span>1</span>
              <div>
                <strong>Resume</strong>
                <small>Select a local file</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Quick questions</strong>
                <small>Add preferences</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Review</strong>
                <small>Preview your profile</small>
              </div>
            </li>
          </ol>
        </aside>

        <form
          className="resume-form form-surface"
          onSubmit={async (event) => {
            event.preventDefault()
            const values = Object.fromEntries(new FormData(event.currentTarget))
            delete values.resume
            try {
              await apiFetch('/api/candidate/resume', {
                method: 'PUT',
                body: JSON.stringify({ draft: { ...values, fileName } }),
              })
              toast('Resume profile draft saved to your demo account.')
            } catch (error) {
              toast(`Could not save resume draft: ${error.message}`)
            }
          }}
        >
          <PreviewNotice>The selected file stays in the browser. Its filename and your answers are saved to your local demo account.</PreviewNotice>
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
              className={`drop-zone${dragActive ? ' drop-zone--active' : ''}${fileName ? ' drop-zone--selected' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragActive(false)
                setLocalFile(event.dataTransfer.files[0])
              }}
            >
              {fileName ? (
                <Check size={28} aria-hidden="true" />
              ) : (
                <UploadCloud size={28} aria-hidden="true" />
              )}
              <h3>{fileName || 'Drag and drop your resume here'}</h3>
              <p>
                {fileName
                  ? 'Selected locally - not uploaded'
                  : 'PDF or DOCX, up to 10MB in the future experience'}
              </p>
              <label className="button button--outline" htmlFor="resume-file">
                {fileName ? 'Choose another file' : 'Choose a file'}
              </label>
              <input
                className="sr-only"
                id="resume-file"
                name="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => setLocalFile(event.target.files[0])}
              />
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
                <select name="studyLevel" defaultValue="">
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
                <input name="institution" type="text" placeholder="Your university or college" />
              </label>
              <label className="form-field">
                <span>Field of study</span>
                <input name="fieldOfStudy" type="text" placeholder="e.g. Information Systems" />
              </label>
              <label className="form-field">
                <span>Graduation year</span>
                <select name="graduationYear" defaultValue="">
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
                <input name="roles" type="text" placeholder="e.g. product design, data, marketing" />
              </label>
              <label className="form-field form-field--wide">
                <span>Preferred work setup</span>
                <select name="workSetup" defaultValue="Flexible">
                  <option>Flexible</option>
                  <option>On-site</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </label>
            </div>
          </section>

          <div className="form-actions">
            <Link className="button button--outline" to="/candidates">
              Back to candidate home
            </Link>
            <button className="button button--dark" type="submit">
              Save preview draft
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}