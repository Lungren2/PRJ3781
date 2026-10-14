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
  MapPin,
  Play,
  Search,
  Sparkles,
  Wallet,
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
import { jobs } from '../data/mockData.js'
import { getHackathons } from '../data/hackathons.js'
import { getCourses } from '../data/courses.js'
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
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    getCourses()
      .then((data) => {
        setCourses(data)
      })
      .catch((err) => {
        console.error('Failed to load courses:', err)
        setError('Could not load courses. Please try again later.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const categories = [
    'All courses',
    ...new Set(courses.map((course) => course.category).filter(Boolean)),
  ]

  const visibleCourses = courses.filter(
    (course) =>
      category === 'All courses' || course.category === category,
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
              A compact starter pathway covering communication, feedback,
              planning, and asking better questions.
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
            {!loading && !error && (
              <StatusPill tone="sage">
                {courses.length} courses
              </StatusPill>
            )}
          </div>

          {!loading && !error && courses.length > 0 && (
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
          )}

          <div className="course-list">
            {loading && (
              <div className="empty-state">
                <p>Loading courses...</p>
              </div>
            )}

            {!loading && error && (
              <div className="empty-state">
                <h2>Courses unavailable</h2>
                <p>{error}</p>
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    setError('')
                    getCourses()
                      .then(setCourses)
                      .catch((err) => {
                        console.error('Failed to load courses:', err)
                        setError('Could not load courses. Please try again later.')
                      })
                      .finally(() => setLoading(false))
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && courses.length === 0 && (
              <div className="empty-state">
                <BookOpen size={28} />
                <h2>No courses found</h2>
                <p>
                  No courses were found in the crawler output.
                  Run the course crawler and try again.
                </p>
              </div>
            )}

            {!loading && !error && courses.length > 0 &&
              visibleCourses.length === 0 && (
                <div className="empty-state">
                  <h2>No courses in this category</h2>
                  <p>Choose another category to see available courses.</p>
                </div>
              )}

            {!loading && !error && visibleCourses.map((course, index) => (
              <article key={course.id || `${course.title}-${index}`}>
                <span className="course-number">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="course-list__copy">
                  <p>{course.category}</p>
                  <h3>{course.title}</h3>

                  <span>
                    {course.provider} · {course.level}
                  </span>

                  <span>
                    {course.duration} · {course.format} · {course.price}
                  </span>

                  {course.description && (
                    <p>{course.description}</p>
                  )}

                  {course.skills?.length > 0 && (
                    <SkillTags skills={course.skills} />
                  )}
                </div>

                {course.courseUrl || course.sourceUrl ? (
                  <a
                    className="icon-button"
                    href={course.courseUrl || course.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${course.title} (opens in a new tab)`}
                  >
                    <ArrowUpRight size={18} />
                  </a>
                ) : (
                  <span>No course link available</span>
                )}
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
  const [hackathons, setHackathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHackathons()
      .then((data) => {
        setHackathons(data)
      })
      .catch((err) => {
        console.error('Failed to load hackathons:', err)
        setError('Could not load hackathons. Please try again later.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

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
          copy="Discover hackathons collected from public sources and organisers."
          status={loading ? 'Loading' : error ? 'Connection issue' : 'Connected'}
          tone={error ? 'blue' : 'sage'}
        />

        <section className="event-list" aria-labelledby="hackathon-list-title">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Upcoming events</p>
              <h2 id="hackathon-list-title">Find a challenge</h2>
            </div>
          </div>

          {loading && <p>Loading hackathons...</p>}

          {!loading && error && (
            <div className="empty-state">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && hackathons.length === 0 && (
            <div className="empty-state">
              <h2>No hackathons found</h2>
              <p>
                No hackathons were found in the crawler output.
                Run the crawler and try again.
              </p>
            </div>
          )}

          {!loading && !error && hackathons.map((event) => (
            <article key={event.id}>
              <div className="event-date">
                <CalendarDays size={22} />
              </div>

              <div className="event-main">
                <p>
                  {Array.isArray(event.themes)
                    ? event.themes.join(', ')
                    : event.themes || 'Hackathon'}
                </p>

                <h3>{event.title}</h3>
                <span>By {event.organizer}</span>

                <div>
                  <span>
                    <CalendarDays size={15} /> {event.startDate}
                    {event.endDate !== 'Not specified'
                      ? ` – ${event.endDate}`
                      : ''}
                  </span>

                  <span>
                    <MapPin size={15} /> {event.location}
                  </span>

                  <span>
                    <Globe2 size={15} /> {event.format}
                  </span>
                </div>

                <p>{event.description}</p>
              </div>

              <div className="event-side">
                <StatusPill tone="sage">
                  Deadline: {event.registrationDeadline}
                </StatusPill>

                {event.registrationUrl ? (
                  <a
                    className="text-action"
                    href={event.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Register / View event <ArrowUpRight size={16} />
                  </a>
                ) : event.sourceUrl ? (
                  <a
                    className="text-action"
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View event <ArrowUpRight size={16} />
                  </a>
                ) : (
                  <span>No event link available</span>
                )}
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
const PROJECT_STATUSES = ['Open', 'In Progress', 'Completed']
export function ProjectsPage() {
  const { activeOrganization, apiFetch } = useAuth()
  const postingOrganization = ['owner', 'recruiter'].includes(activeOrganization?.role) ? activeOrganization : null
  const [department, setDepartment] = useState('All departments')
  const [status, setStatus] = useState('Open')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    apiFetch('/api/product-requests')
      .then((data) => { if (active) setProjects(data) })
      .catch((error) => { if (active) setLoadError(`Could not load project requests: ${error.message}`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch])

  const departments = useMemo(
    () => [...new Set(projects.map((project) => project.department))].sort((a, b) => a.localeCompare(b)),
    [projects],
  )

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          (department === 'All departments' || project.department === department) &&
          (status === 'All statuses' || project.status === status),
      ),
    [projects, department, status],
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
          copy="Employers post short, scoped (often paid) projects; candidates apply with their Morrow account."
          status="Connected"
          tone="sage"
        />
        <section className="project-browser" aria-labelledby="project-list-title">
          <aside className="project-filters">
            <p className="eyebrow">Find a brief</p>
            <h2>Filter projects</h2>
            <label>
              <span>Department</span>
              <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                <option>All departments</option>
                {departments.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option>All statuses</option>
                {PROJECT_STATUSES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
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
                <p className="eyebrow">{status === 'All statuses' ? 'All requests' : `${status} requests`}</p>
                <h2 id="project-list-title">
                  {loading
                    ? 'Loading...'
                    : `${visibleProjects.length} project brief${visibleProjects.length === 1 ? '' : 's'}`}
                </h2>
              </div>
              {postingOrganization && (
                <Link className="button button--dark" to="/employers/post-job?kind=project">
                  + Post a paid project
                </Link>
              )}
            </div>

            {loadError && <p role="alert">{loadError}</p>}
            {visibleProjects.length === 0 && !loading && !loadError ? (
              <div className="empty-state">
                <Layers3 size={28} />
                <h2>No project requests here yet</h2>
                <p>
                  {postingOrganization
                    ? 'Post a request and it will appear here.'
                    : 'Try another filter, or check back when organisations post new briefs.'}
                </p>
              </div>
            ) : (
              visibleProjects.map((project) => (
                <article key={project.id}>
                  <div className="project-row__top">
                    <span className="project-icon">
                      <Layers3 size={20} />
                    </span>
                    <StatusPill tone={project.status === 'Open' ? 'sage' : 'blue'}>{project.status}</StatusPill>
                  </div>
                  <p>{project.companyName}</p>
                  <h3>{project.title}</h3>
                  <div className="project-row__meta">
                    <span>
                      <BriefcaseBusiness size={15} /> {project.department}
                    </span>
                    <span>
                      <Clock3 size={15} /> {project.category}
                    </span>
                    <span>
                      <Wallet size={15} /> {project.pay || 'Unpaid'}
                      {project.duration ? ' · ' + project.duration : ''}
                    </span>
                    <span>
                      <CalendarDays size={15} />{' '}
                      {project.deadline ? `Apply by ${new Date(project.deadline).toLocaleDateString()}` : 'No deadline'}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  <Link to={`/projects/${project.id}`} className="text-action">
                    {project.viewer.hasApplied ? 'Applied - view project' : 'View project'} <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
