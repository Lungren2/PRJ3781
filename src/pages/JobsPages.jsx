import { useMemo, useState } from 'react'
import { ArrowRight, FileText, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  JobList,
  PageIntro,
  PreviewNotice,
  ProgressBar,
  SearchPanel,
  StatusPill,
} from '../components/ProductUI.jsx'
import { jobs } from '../data/mockData.js'
import { useToast } from '../components/ToastContext.jsx'

const jobTypes = ['All', 'Part-time', 'Internship', 'Entry level']

export function JobsPage({ preset = 'All' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [keyword, setKeyword] = useState(searchParams.get('query') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [type, setType] = useState(preset)
  const [mode, setMode] = useState('All setups')
  const [sort, setSort] = useState('Most recent')
  const toast = useToast()

  const results = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const normalizedLocation = location.trim().toLowerCase()
    const filtered = jobs.filter((job) => {
      const searchable = `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase()
      const locationText = `${job.location} ${job.mode}`.toLowerCase()
      return (
        (!normalizedKeyword || searchable.includes(normalizedKeyword)) &&
        (!normalizedLocation || locationText.includes(normalizedLocation)) &&
        (type === 'All' || job.type === type) &&
        (mode === 'All setups' || job.mode === mode)
      )
    })

    if (sort === 'Best match') return [...filtered].sort((a, b) => b.match - a.match)
    return filtered
  }, [keyword, location, type, mode, sort])

  const title = preset === 'All' ? 'Active jobs' : `${preset} opportunities`

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Opportunity search"
        title={title}
        copy="Search realistic sample listings and try the filters that will later connect to the live opportunity database."
      >
        <Link className="button button--outline" to="/jobs/recommended">
          See recommended jobs
        </Link>
      </PageIntro>
      <div className="page-container jobs-workspace">
        <SearchPanel
          keyword={keyword}
          onKeywordChange={setKeyword}
          location={location}
          onLocationChange={setLocation}
          onSubmit={(event) => {
            event.preventDefault()
            const nextParams = new URLSearchParams()
            if (keyword) nextParams.set('query', keyword)
            if (location) nextParams.set('location', location)
            setSearchParams(nextParams)
            toast(`${results.length} sample job${results.length === 1 ? '' : 's'} found.`)
          }}
        >
          <div className="filter-chips" aria-label="Job type filters">
            {jobTypes.map((jobType) => (
              <button
                key={jobType}
                type="button"
                className={type === jobType ? 'is-active' : ''}
                aria-pressed={type === jobType}
                onClick={() => setType(jobType)}
              >
                {jobType}
              </button>
            ))}
          </div>
          <label className="compact-select">
            <span className="sr-only">Work setup</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option>All setups</option>
              <option>On-site</option>
              <option>Hybrid</option>
              <option>Remote</option>
              <option>Remote-friendly</option>
              <option>Flexible</option>
            </select>
          </label>
        </SearchPanel>

        <PreviewNotice>
          Search and filters work against mock listings in this frontend. No crawler or database is
          connected yet.
        </PreviewNotice>

        <section className="results-section" aria-labelledby="job-results-title">
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Current results</p>
              <h2 id="job-results-title">{results.length} sample jobs</h2>
            </div>
            <label className="sort-control">
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option>Most recent</option>
                <option>Best match</option>
              </select>
            </label>
          </div>
          <JobList items={results} />
        </section>
      </div>
    </main>
  )
}

export function RecommendedJobsPage() {
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="For you"
        title="Recommended jobs"
        copy="A preview of how resume details and preferences can shape a more relevant job feed."
        tone="sage"
      >
        <StatusPill tone="coral">Sample matches</StatusPill>
      </PageIntro>

      <div className="page-container recommendation-layout">
        <aside className="match-profile">
          <span className="match-profile__icon">
            <Sparkles size={24} aria-hidden="true" />
          </span>
          <p className="eyebrow">Matching profile</p>
          <h2>Help Morrow learn what fits.</h2>
          <p>Add a resume and preferences to improve the future recommendations shown here.</p>
          <ProgressBar value={72} label="Preview profile" />
          <Link className="button button--dark" to="/candidates/resume">
            <FileText size={17} aria-hidden="true" /> Upload resume
          </Link>
          <div className="preference-summary">
            <span>Design</span>
            <span>Data</span>
            <span>Hybrid</span>
            <span>Cape Town</span>
          </div>
        </aside>
        <section className="recommended-results" aria-labelledby="recommended-title">
          <PreviewNotice>
            Match percentages are static sample values for the UI shell.
          </PreviewNotice>
          <div className="content-heading">
            <div>
              <p className="eyebrow">Based on sample preferences</p>
              <h2 id="recommended-title">Strong starting points</h2>
            </div>
            <Link className="inline-link product-inline-link" to="/jobs">
              All active jobs <ArrowRight size={17} />
            </Link>
          </div>
          <JobList items={jobs.slice(0, 5)} showMatch />
        </section>
      </div>
    </main>
  )
}
