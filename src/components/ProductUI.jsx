import { useState } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Info,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastContext.jsx'

export function PageIntro({ eyebrow, title, copy, children, tone = 'light' }) {
  return (
    <section className={`page-intro page-intro--${tone}`}>
      <div className="page-intro__inner">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-intro__copy">{copy}</p>
        </div>
        {children && <div className="page-intro__actions">{children}</div>}
      </div>
    </section>
  )
}

export function PreviewNotice({
  children = 'This page uses sample content and frontend-only interactions.',
}) {
  return (
    <div className="preview-notice" role="note">
      <Info size={17} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

export function StatusPill({ children, tone = 'sage' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

export function SkillTags({ skills }) {
  return (
    <div className="skill-tags" aria-label="Skills">
      {skills.map((skill) => (
        <span key={skill}>{skill}</span>
      ))}
    </div>
  )
}

export function JobRow({ job, showMatch = false }) {
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  return (
    <article className="job-row">
      <div className={`company-mark company-mark--${job.tone}`} aria-hidden="true">
        {job.mark}
      </div>
      <div className="job-row__main">
        <div className="job-row__title-line">
          <div>
            <h3>{job.title}</h3>
            <p>{job.company}</p>
          </div>
          {showMatch && <span className="match-score">{job.match}% match</span>}
        </div>
        <div className="job-row__meta">
          <span>
            <MapPin size={15} aria-hidden="true" /> {job.location} - {job.mode}
          </span>
          <span>
            <BriefcaseBusiness size={15} aria-hidden="true" /> {job.type}
          </span>
          <span>
            <Clock3 size={15} aria-hidden="true" /> {job.posted}
          </span>
        </div>
        <SkillTags skills={job.skills} />
      </div>
      <div className="job-row__side">
        <strong>{job.pay}</strong>
        <span>{job.source}</span>
        <div className="job-row__actions">
          <button
            className={`icon-button${saved ? ' icon-button--saved' : ''}`}
            type="button"
            aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
            aria-pressed={saved}
            onClick={() => {
              setSaved((value) => !value)
              toast(
                saved
                  ? 'Removed from your preview saves.'
                  : 'Saved locally for this preview session.',
              )
            }}
          >
            {saved ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Bookmark size={18} aria-hidden="true" />
            )}
          </button>
          <button
            className="text-action"
            type="button"
            onClick={() =>
              toast('The full job detail and application flow will connect here later.')
            }
          >
            View role <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export function JobList({ items, showMatch = false }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Search size={28} aria-hidden="true" />
        <h2>No sample jobs match those filters</h2>
        <p>Try a broader keyword or reset the job type.</p>
      </div>
    )
  }

  return (
    <div className="job-list">
      {items.map((job) => (
        <JobRow key={job.id} job={job} showMatch={showMatch} />
      ))}
    </div>
  )
}

export function SearchPanel({
  keyword,
  onKeywordChange,
  location,
  onLocationChange,
  onSubmit,
  children,
}) {
  return (
    <form className="search-panel" onSubmit={onSubmit}>
      <div className="search-panel__fields">
        <label className="form-field form-field--with-icon">
          <span>Role, skill, or company</span>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="Try data analyst"
            />
          </div>
        </label>
        <label className="form-field form-field--with-icon">
          <span>Location</span>
          <div>
            <MapPin size={18} aria-hidden="true" />
            <input
              type="text"
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="City or remote"
            />
          </div>
        </label>
        <button className="button button--dark" type="submit">
          Search jobs
        </button>
      </div>
      <div className="search-panel__filters">
        <span>
          <SlidersHorizontal size={16} aria-hidden="true" /> Filters
        </span>
        {children}
      </div>
    </form>
  )
}

export function RouteList({ items }) {
  return (
    <div className="route-list">
      {items.map(({ to, title, description, meta, icon: Icon }) => (
        <Link key={to} to={to} className="route-list__item">
          {Icon && (
            <span className="route-list__icon">
              <Icon size={21} aria-hidden="true" />
            </span>
          )}
          <span className="route-list__copy">
            <strong>{title}</strong>
            <span>{description}</span>
          </span>
          {meta && <span className="route-list__meta">{meta}</span>}
          <ChevronRight size={19} aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}

export function ProgressBar({ value, label }) {
  return (
    <div className="progress-block">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <span className="progress-track" aria-hidden="true">
        <span style={{ width: `${value}%` }} />
      </span>
    </div>
  )
}
