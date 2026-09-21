import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  Code2,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  GraduationCap,
  Layers3,
  Link2,
  MapPin,
  Play,
  Search,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  JobList,
  PageIntro,
  PreviewNotice,
  ProgressBar,
  SkillTags,
  StatusPill,
} from '../components/ProductUI.jsx'
import { courses, hackathons, jobs } from '../data/mockData.js'
import { useToast } from '../components/ToastContext.jsx'
import { useAuth } from '../components/AuthContext.jsx'
import {
  fetchCertifications,
  fetchFacets,
  fetchHealth,
  relativeTime,
} from '../data/certificationsApi.js'

function ModuleStrip({ label, title, copy, status = 'Connection pending', tone = 'blue' }) {
  return (
    <div className="module-strip">
      <span className="module-strip__icon">
        <Code2 size={20} aria-hidden="true" />
      </span>
      <div>
        <p>{label}</p>
        <h2>{title}</h2>
        <span>{copy}</span>
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
    </div>
  )
}

export function CoursesPage() {
  const [category, setCategory] = useState('All courses')
  const toast = useToast()
  const categories = ['All courses', 'Career skills', 'Workplace tools', 'Portfolio']
  const visibleCourses = courses.filter(
    (course) => category === 'All courses' || course.category === category,
  )

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Learning"
        title="Courses for the work ahead."
        copy="Short, practical learning paths designed around the skills students need before and during their first roles."
        tone="sage"
      >
        <Link className="button button--dark" to="/discover/certifications">
          Browse certifications
        </Link>
      </PageIntro>
      <div className="page-container courses-layout">
        <section className="course-feature" aria-labelledby="course-feature-title">
          <span className="course-feature__shape" aria-hidden="true">
            <Play fill="currentColor" />
          </span>
          <div>
            <p className="eyebrow">Featured pathway</p>
            <h2 id="course-feature-title">Ready for your first week at work.</h2>
            <p>
              A compact starter pathway covering communication, feedback, planning, and asking
              better questions.
            </p>
            <button
              className="button button--white"
              type="button"
              onClick={() => toast('Course playback will connect here later.')}
            >
              Preview pathway <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <section className="course-library" aria-labelledby="course-library-title">
          <div className="content-heading">
            <div>
              <p className="eyebrow">Course library</p>
              <h2 id="course-library-title">Learn at your pace</h2>
            </div>
          </div>
          <div className="filter-chips" aria-label="Course categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? 'is-active' : ''}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="course-list">
            {visibleCourses.map((course, index) => (
              <article key={course.title}>
                <span className="course-number">0{index + 1}</span>
                <div className="course-list__copy">
                  <p>{course.category}</p>
                  <h3>{course.title}</h3>
                  <span>
                    {course.length} - {course.level}
                  </span>
                  {course.progress > 0 && (
                    <ProgressBar value={course.progress} label="Preview progress" />
                  )}
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Open ${course.title}`}
                  onClick={() => toast('The course lesson view will connect here later.')}
                >
                  <ArrowUpRight size={18} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export function JobCrawlerPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Discovery engine"
        title="Job crawler feed"
        copy="A frontend view for opportunities that the future crawler will collect, standardise, and send into Morrow."
      />
      <div className="page-container module-page">
        <ModuleStrip
          label="Project module"
          title="Job crawler"
          copy="Future service: collect student-focused jobs from public sources."
        />
        <PreviewNotice>
          The listings below are static mock data. No websites are being crawled.
        </PreviewNotice>
        <section className="feed-controls" aria-label="Crawler feed filters">
          <label className="form-field form-field--with-icon">
            <span>Search collected jobs</span>
            <div>
              <Search size={18} />
              <input type="search" placeholder="Role, source, or skill" />
            </div>
          </label>
          <label className="form-field">
            <span>Source type</span>
            <select defaultValue="All sources">
              <option>All sources</option>
              <option>Company careers pages</option>
              <option>Public listings</option>
              <option>Employer submissions</option>
            </select>
          </label>
          <button className="button button--outline" type="button">
            <Filter size={17} /> More filters
          </button>
        </section>
        <section className="results-section" aria-labelledby="crawler-results-title">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Normalised feed preview</p>
              <h2 id="crawler-results-title">Collected opportunities</h2>
            </div>
            <StatusPill tone="sage">8 mock records</StatusPill>
          </div>
          <JobList items={jobs.slice(0, 6)} />
        </section>
      </div>
    </main>
  )
}

export function HackathonsPage() {
  const toast = useToast()
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Build and compete"
        title="Hackathons"
        copy="Discover challenges where students can test ideas, meet collaborators, and build something worth showing."
        tone="ink"
      />
      <div className="page-container module-page">
        <ModuleStrip
          label="Project module"
          title="Hackathon crawler"
          copy="Future service: collect public hackathon listings from companies and organisers."
        />
        <PreviewNotice>
          Events, organisers, and dates are fictional examples for the frontend shell.
        </PreviewNotice>
        <section className="event-list" aria-labelledby="hackathon-list-title">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Upcoming events</p>
              <h2 id="hackathon-list-title">Find a challenge</h2>
            </div>
            <div className="filter-chips">
              <button className="is-active" type="button">
                All
              </button>
              <button type="button">Virtual</button>
              <button type="button">In person</button>
            </div>
          </div>
          {hackathons.map((event, index) => (
            <article key={event.name}>
              <div className="event-date">
                <span>AUG</span>
                <strong>{22 + index * 7}</strong>
              </div>
              <div className="event-main">
                <p>{event.theme}</p>
                <h3>{event.name}</h3>
                <span>By {event.organiser}</span>
                <div>
                  <span>
                    <CalendarDays size={15} /> {event.date}
                  </span>
                  <span>
                    <MapPin size={15} /> {event.location}
                  </span>
                  <span>
                    <Globe2 size={15} /> {event.format}
                  </span>
                </div>
              </div>
              <div className="event-side">
                <StatusPill tone={index === 0 ? 'coral' : 'sage'}>{event.deadline}</StatusPill>
                <button
                  className="text-action"
                  type="button"
                  onClick={() =>
                    toast('The event detail and registration flow will connect here later.')
                  }
                >
                  View event <ArrowUpRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

// Mirrors the server-side vocabulary in server/src/normalize/taxonomy.js.
const SKILL_LABELS = {
  'software-development': 'Software development',
  'data-analytics': 'Data & analytics',
  'cloud-infrastructure': 'Cloud & infrastructure',
  cybersecurity: 'Cybersecurity',
  'ai-machine-learning': 'AI & machine learning',
  databases: 'Databases',
  networking: 'Networking',
  'it-support': 'IT support',
  'ux-design': 'UX & design',
  'product-project-management': 'Product & project management',
}

const LEVEL_LABELS = {
  beginner: 'Beginner',
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  unspecified: 'Not stated',
}

function CertificationRow({ certificate }) {
  const toast = useToast()
  const meta = [
    LEVEL_LABELS[certificate.level] ?? certificate.level,
    certificate.duration,
    certificate.format,
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    <article>
      <span className="certificate-icon">
        <GraduationCap size={22} aria-hidden="true" />
      </span>
      <div>
        <p>{certificate.providerName}</p>
        <h3>{certificate.title}</h3>
        <span>{meta}</span>
        {certificate.skills?.length > 0 && (
          <SkillTags skills={certificate.skills.map((skill) => SKILL_LABELS[skill] ?? skill)} />
        )}
      </div>
      {certificate.url ? (
        <a
          className="icon-button"
          href={certificate.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${certificate.title} on ${certificate.providerName} (opens in a new tab)`}
        >
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      ) : (
        <button
          className="icon-button"
          type="button"
          aria-label={`Preview ${certificate.title}`}
          onClick={() =>
            toast('This is sample content. Live links arrive with the next crawler run.')
          }
        >
          <ExternalLink size={17} aria-hidden="true" />
        </button>
      )}
    </article>
  )
}

export function CertificationsPage() {
  const [skill, setSkill] = useState('')
  const [type, setType] = useState('')
  const [level, setLevel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState({ items: [], total: 0, source: null })
  const [facets, setFacets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // Debounced so typing in the keyword field does not fire a request per keystroke.
    const timer = window.setTimeout(() => {
      setLoading(true)
      const filters = { skill, type, level, q: keyword }
      Promise.all([
        fetchCertifications({ ...filters, pageSize: 24 }, controller.signal),
        fetchFacets(filters, controller.signal),
      ])
        .then(([data, nextFacets]) => {
          setResults(data)
          setFacets(nextFacets)
          setLoading(false)
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setLoading(false)
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [skill, type, level, keyword])

  const visible = (options, selected) =>
    (options ?? []).filter((option) => option.count > 0 || option.id === selected)

  const typeOptions = useMemo(() => visible(facets?.types, type), [facets, type])
  const skillOptions = useMemo(() => visible(facets?.skills, skill), [facets, skill])
  const levelOptions = useMemo(() => visible(facets?.levels, level), [facets, level])

  const isLive = results.source === 'live'
  const lastUpdated = relativeTime(health?.lastSuccessAt ?? health?.generatedAt)

  const statusLabel = !results.source
    ? 'Checking\u2026'
    : isLive
      ? lastUpdated
        ? `Updated ${lastUpdated}`
        : 'Connected'
      : results.source === 'snapshot'
        ? 'Showing last saved crawl'
        : 'Connection pending'

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Credentials"
        title="Certifications worth exploring."
        copy="Compare beginner-friendly credentials and map them to the kinds of roles you want to pursue."
        tone="sage"
      >
        <Link className="button button--dark" to="/courses">
          Explore Morrow courses
        </Link>
      </PageIntro>
      <div className="page-container module-page">
        {/* <ModuleStrip
          label="Project module"
          title="Certification crawler"
          copy="Collects public course and certificate listings from Coursera and Microsoft Learn."
          status={statusLabel}
          tone={isLive ? 'sage' : 'blue'}
        />*/}
        {/* {results.source && (
          <PreviewNotice>
            {isLive && 'Listings come from the Coursera and Microsoft Learn public catalogues. Opening a credential takes you to the provider\u2019s own site.'}
            {results.source === 'snapshot' && 'The crawler service is not responding, so these listings come from the last saved crawl.'}
            {results.source === 'sample' && 'Showing sample content. Start the crawler service to browse live listings.'}
          </PreviewNotice>
        )}*/}

        <section className="certification-browser" aria-labelledby="certificate-list-title">
          <div className="certification-filters">
            <p className="eyebrow">Filter credentials</p>
            <label className="form-field form-field--with-icon">
              <span>Search</span>
              <div>
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Try cloud or analytics"
                />
              </div>
            </label>
            <label>
              <span>Technical skill</span>
              <select value={skill} onChange={(event) => setSkill(event.target.value)}>
                <option value="">All skills</option>
                {skillOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Level</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="">All levels</option>
                {levelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="certification-results">
            <div className="results-toolbar">
              <div>
                <p className="eyebrow">Catalogue</p>
                <h2 id="certificate-list-title">
                  {loading
                    ? 'Loading credentials'
                    : `${results.total} credential${results.total === 1 ? '' : 's'}`}
                </h2>
              </div>
            </div>

            {typeOptions.length > 0 && (
              <div className="filter-chips" aria-label="Credential type">
                <button
                  type="button"
                  className={type === '' ? 'is-active' : ''}
                  aria-pressed={type === ''}
                  onClick={() => setType('')}
                >
                  All types
                </button>
                {typeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={type === option.id ? 'is-active' : ''}
                    aria-pressed={type === option.id}
                    onClick={() => setType(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {results.items.length === 0 && !loading ? (
              <div className="empty-state">
                <Search size={28} aria-hidden="true" />
                <h2>No credentials match those filters</h2>
                <p>Try a broader skill, or reset the level and type.</p>
              </div>
            ) : (
              results.items.map((certificate) => (
                <CertificationRow key={certificate.id} certificate={certificate} />
              ))
            )}

            {results.total > results.items.length && (
              <p className="certification-results__more">
                Showing {results.items.length} of {results.total}. Narrow the filters to see more
                specific results.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
export function PortfolioBuilderPage() {
  const [name, setName] = useState('Your Name')
  const [headline, setHeadline] = useState('Student designer and thoughtful problem solver')
  const [sections, setSections] = useState({ projects: true, education: true, experience: false })
  const toast = useToast()

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="CV and portfolio builder"
        title="Turn your work into a story."
        copy="Shape a clean public profile from your CV, practical projects, and Morrow activity."
        tone="ink"
      >
        <StatusPill tone="sage">Builder preview</StatusPill>
      </PageIntro>
      <div className="page-container module-page">
        <ModuleStrip
          label="Project module"
          title="CV portfolio builder"
          copy="Future service: combine CV details and completed work into a shareable page."
        />
        <PreviewNotice>
          The preview is local. Public links and saved profiles are not generated yet.
        </PreviewNotice>
        <div className="portfolio-builder">
          <form
            className="portfolio-controls"
            onSubmit={(event) => {
              event.preventDefault()
              toast('Portfolio draft saved locally for this preview.')
            }}
          >
            <p className="eyebrow">Profile details</p>
            <h2>Shape your page</h2>
            <label className="form-field">
              <span>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Headline</span>
              <textarea
                rows="3"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </label>
            <fieldset>
              <legend>Include sections</legend>
              {Object.entries(sections).map(([key, checked]) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setSections((current) => ({ ...current, [key]: event.target.checked }))
                    }
                  />
                  <span>{key[0].toUpperCase() + key.slice(1)}</span>
                </label>
              ))}
            </fieldset>
            <div className="portfolio-controls__link">
              <Link2 size={17} />
              <span>morrow.local/portfolio/your-name</span>
            </div>
            <button className="button button--dark" type="submit">
              Save preview draft
            </button>
          </form>
          <section className="portfolio-preview" aria-label="Portfolio page preview">
            <div className="portfolio-preview__browser">
              <span />
              <span />
              <span />
              <small>Portfolio preview</small>
            </div>
            <div className="portfolio-preview__body">
              <span className="portfolio-avatar" aria-hidden="true">
                {name === 'Your Name'
                  ? 'YN'
                  : name
                      .split(' ')
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
              </span>
              <p>Portfolio / 2026</p>
              <h2>{name || 'Your Name'}</h2>
              <h3>{headline || 'Add a short headline'}</h3>
              {sections.projects && (
                <div className="portfolio-preview__section">
                  <span>Selected project</span>
                  <strong>Student experience research</strong>
                  <p>A short case study preview will appear here.</p>
                </div>
              )}
              {sections.education && (
                <div className="portfolio-preview__line">
                  <span>Education</span>
                  <strong>Your programme and institution</strong>
                </div>
              )}
              {sections.experience && (
                <div className="portfolio-preview__line">
                  <span>Experience</span>
                  <strong>Your work and practical experience</strong>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export function ProjectsPage() {
  const toast = useToast()
  const { user, apiFetch } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    companyName: "",
    department: "",
    category: "",
    deadline: "",
    description: "",
  })
  const [department, setDepartment] = useState('All departments')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/product-requests')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    const organization = user?.organizations?.[0]
    if (!organization) return

    const newProject = await apiFetch('/api/product-requests', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: organization.id,
        title: formData.title,
        companyName: formData.companyName,
        department: formData.department,
        category: formData.category,
        deadline: formData.deadline,
        description: formData.description,
        status: 'Open',
      }),
    })

    setProjects((prev) => [newProject, ...prev])
    setShowForm(false)

    setFormData({
      title: "",
      companyName: "",
      department: "",
      category: "",
      deadline: "",
      description: "",
    })
  }

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          department === 'All departments' ||
          project.department === department
      ),
    [projects, department]
  )

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Practical experience"
        title="Student project requests"
        copy="Take on small, useful briefs from university departments and external organisations, then carry completed work into your portfolio."
        tone="sage"
      />
      <div className="page-container module-page">
        <ModuleStrip
          label="Project module"
          title="Product requests"
          copy="Future service: post, join, track, and complete small scoped projects."
          status="Connected"
          tone="sage"
        />
        <PreviewNotice>
          Organisations and briefs are fictional examples. Joining and completion states are
          frontend placeholders.
        </PreviewNotice>
        <section className="project-browser" aria-labelledby="project-list-title">
          <aside className="project-filters">
            <p className="eyebrow">Find a brief</p>
            <h2>Filter projects</h2>
            <label>
              <span>Department</span>
              <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                <option>All departments</option>
                <option>Information Systems</option>
                <option>Marketing</option>
                <option>Design</option>
                <option>Computer Science</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select defaultValue="Open">
                <option>Open</option>
                <option>In progress</option>
                <option>Completed</option>
              </select>
            </label>
            <div>
              <Check size={18} />
              <p>
                <strong>Completed work, connected.</strong>
                <span>Future completed projects can feed directly into the portfolio builder.</span>
              </p>
            </div>
          </aside>
          <div className="project-results">
            <div className="results-toolbar">
              <div>
                <p className="eyebrow">Open requests</p>
                <h2 id="project-list-title">
                  {loading ? 'Loading...' : `${visibleProjects.length} project briefs`}
                </h2>
              </div>
              {user?.organizations?.length > 0 && (
                <button
                  className="button button--dark"
                  type="button"
                  onClick={() => {
                    setFormData((current) => ({
                      ...current,
                      companyName: user.organizations[0].name,
                    }))
                    setShowForm(true)
                  }}
                >
                  + Post Request
                </button>
              )}
            </div>

            {visibleProjects.length === 0 && !loading ? (
              <div className="empty-state">
                <Layers3 size={28} />
                <h2>No project requests yet</h2>
                <p>Create a Product Request and it will appear here.</p>
              </div>
            ) : (
              visibleProjects.map((project) => (
                <article key={project._id || project.title}>
                  <div className="project-row__top">
                    <span className="project-icon">
                      <Layers3 size={20} />
                    </span>
                    <StatusPill tone={project.status === 'Open' ? 'sage' : 'blue'}>
                      {project.status}
                    </StatusPill>
                  </div>
                  <p>{project.companyName || project.organisation}</p>
                  <h3>{project.title}</h3>
                  <div className="project-row__meta">
                    <span>
                      <BriefcaseBusiness size={15} /> {project.department}
                    </span>
                    <span>
                      <Clock3 size={15} /> {project.category || project.commitment}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  <Link
                    to={`/projects/${project.id}`}
                    className="text-action"
                  >
                    View project <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Post a Product Request</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>

            <p>
              Employers and university departments can create a new project request here.
            </p>

            <form className="modal-form" onSubmit={handleSubmit}>
              <label>
                Project Title
                <input
                  type="text"
                  placeholder="e.g. GradConnect Landing Page"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <label>
                Company / Organisation
                <input
                  type="text"
                  placeholder="Belgium Campus"
                  value={formData.companyName}
                  readOnly
                />
              </label>

              <label>
                Department
                <input
                  type="text"
                  placeholder="Information Systems"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </label>

              <label>
                Category
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="" disabled>Select a category</option>
                  <option value="Web Development">Web Development</option>
                  <option value="Mobile Development">Mobile Development</option>
                  <option value="UI/UX Design">UI/UX Design</option>
                  <option value="Data Analysis">Data Analysis</option>
                  <option value="Research">Research</option>
                  <option value="Marketing">Marketing</option>
                  <option value="General">General</option>
                </select>
              </label>

              <label>
                Deadline
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </label>

              <label>
                Description
                <textarea
                  rows="4"
                  placeholder="Describe what students will be working on..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button className="button button--dark modal-continue" type="submit">
                  Post Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}