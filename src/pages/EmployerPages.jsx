import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageIntro, PreviewNotice, SkillTags, StatusPill } from '../components/ProductUI.jsx'
import { candidates } from '../data/mockData.js'
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

export function BrowseCandidatesPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('All locations')
  const toast = useToast()
  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const text =
          `${candidate.name} ${candidate.programme} ${candidate.skills.join(' ')}`.toLowerCase()
        return (
          text.includes(query.toLowerCase()) &&
          (location === 'All locations' || candidate.location === location)
        )
      }),
    [query, location],
  )

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Talent discovery"
        title="Browse candidates"
        copy="Search sample candidate profiles and preview the employer shortlist experience."
      />
      <div className="page-container candidate-browser">
        <form
          className="candidate-filters"
          onSubmit={(event) => {
            event.preventDefault()
            toast(`${filteredCandidates.length} sample candidates found.`)
          }}
        >
          <label className="form-field form-field--with-icon">
            <span>Skill, programme, or candidate</span>
            <div>
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try React or marketing"
              />
            </div>
          </label>
          <label className="form-field">
            <span>Location</span>
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option>All locations</option>
              <option>Cape Town</option>
              <option>Johannesburg</option>
              <option>Pretoria</option>
            </select>
          </label>
          <button className="button button--dark" type="submit">
            Search talent
          </button>
        </form>
        <PreviewNotice>Names and profiles on this page are fictional sample content.</PreviewNotice>
        <section className="candidate-list" aria-labelledby="candidate-list-title">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Talent pool preview</p>
              <h2 id="candidate-list-title">{filteredCandidates.length} candidates</h2>
            </div>
            <StatusPill tone="sage">Sample profiles</StatusPill>
          </div>
          {filteredCandidates.map((candidate) => (
            <article className="candidate-row" key={candidate.name}>
              <div className="candidate-avatar" aria-hidden="true">
                {candidate.initials}
              </div>
              <div className="candidate-row__identity">
                <h3>{candidate.name}</h3>
                <p>{candidate.programme}</p>
                <span>{candidate.institution}</span>
              </div>
              <div className="candidate-row__details">
                <strong>{candidate.location}</strong>
                <span>{candidate.availability}</span>
                <SkillTags skills={candidate.skills} />
              </div>
              <button
                className="text-action"
                type="button"
                onClick={() =>
                  toast('The full candidate profile and shortlist flow will connect here later.')
                }
              >
                View profile <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

export function PostJobPage() {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Internship')
  const [location, setLocation] = useState('')
  const toast = useToast()
  const { user, apiFetch } = useAuth()
  const organization = user.organizations[0]

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Employer workspace"
        title="Post a job"
        copy="Shape a clear early-career role and preview how it will appear to candidates."
        tone="sage"
      >
        <StatusPill tone="blue">Draft mode</StatusPill>
      </PageIntro>
      <div className="page-container job-post-layout">
        <form
          className="form-surface job-post-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const draft = Object.fromEntries(new FormData(event.currentTarget))
            try {
              await apiFetch(`/api/organizations/${organization.id}/jobs`, {
                method: 'POST',
                body: JSON.stringify({ draft }),
              })
              toast('Job draft saved to your organization workspace. It was not published.')
            } catch (error) {
              toast(`Could not save job draft: ${error.message}`)
            }
          }}
        >
          <PreviewNotice>The draft is saved to your demo organization. No listing will be published.</PreviewNotice>
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
                <input
                  name="title"
                  required
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Junior Data Analyst"
                />
              </label>
              <label className="form-field">
                <span>Opportunity type</span>
                <select name="type" value={type} onChange={(event) => setType(event.target.value)}>
                  <option>Internship</option>
                  <option>Part-time</option>
                  <option>Entry level</option>
                  <option>Graduate programme</option>
                </select>
              </label>
              <label className="form-field">
                <span>Location</span>
                <input
                  name="location"
                  required
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City or remote"
                />
              </label>
              <label className="form-field">
                <span>Work setup</span>
                <select name="workSetup" defaultValue="Hybrid">
                  <option>On-site</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </label>
              <label className="form-field">
                <span>Pay or stipend</span>
                <input name="pay" type="text" placeholder="e.g. R9 000 / month" />
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
                <textarea
                  name="description"
                  rows="6"
                  placeholder="Describe the work, team, and a typical first project."
                />
              </label>
              <label className="form-field form-field--wide">
                <span>Useful skills</span>
                <input name="skills" type="text" placeholder="e.g. Excel, SQL, clear communication" />
              </label>
            </div>
          </section>
          <div className="form-actions">
            <Link className="button button--outline" to="/employers">
              Cancel preview
            </Link>
            <button className="button button--dark" type="submit">
              Save job draft
            </button>
          </div>
        </form>
        <aside className="job-preview" aria-labelledby="job-preview-title">
          <div>
            <ShieldCheck size={22} />
            <span>Candidate view preview</span>
          </div>
          <p className="eyebrow">{type}</p>
          <h2 id="job-preview-title">{title || 'Your job title'}</h2>
          <p>Sample Company</p>
          <span>{location || 'Location'} - Hybrid</span>
          <hr />
          <h3>About the opportunity</h3>
          <p>Your role description will preview here as you shape the future listing.</p>
          <SkillTags skills={['Early career', 'Clear brief', 'Sample']} />
        </aside>
      </div>
    </main>
  )
}