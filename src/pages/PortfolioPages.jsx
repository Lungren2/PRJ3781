import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageIntro, PreviewNotice, SkillTags, StatusPill } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'

const LINK_LABELS = { linkedin: 'LinkedIn', github: 'GitHub', website: 'Website' }

function initials(name) {
  return (
    (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || 'YN'
  )
}

function dateRange(entry) {
  if (entry.startDate && entry.endDate) return `${entry.startDate} – ${entry.endDate}`
  return entry.startDate || entry.endDate || ''
}

function splitSkills(text) {
  return [...new Set(text.split(',').map((skill) => skill.trim()).filter(Boolean))]
}

function portfolioUrl(slug) {
  return `${window.location.origin}/portfolio/${slug}`
}

function EntryList({ title, entries }) {
  if (entries.length === 0) return null
  return (
    <div className="portfolio-block">
      <h4>{title}</h4>
      {entries.map((entry, index) => (
        <article className="portfolio-entry" key={entry.id || entry._key || index}>
          <div className="portfolio-entry__head">
            <strong>{entry.title}</strong>
            {dateRange(entry) && <span>{dateRange(entry)}</span>}
          </div>
          {(entry.role || entry.organisation) && (
            <p className="portfolio-entry__meta">{[entry.role, entry.organisation].filter(Boolean).join(' · ')}</p>
          )}
          {entry.description && <p className="portfolio-entry__text">{entry.description}</p>}
          {entry.url && (
            <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow">
              View work <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </article>
      ))}
    </div>
  )
}

// The portfolio itself: used for the builder preview, the public page and printing.
export function PortfolioView({ portfolio, education, morrowWork }) {
  const visible = portfolio.entries.filter((entry) => !entry.hidden && entry.title)
  const projects = visible.filter((entry) => entry.kind === 'project')
  const experience = visible.filter((entry) => entry.kind === 'experience')
  const links = Object.entries(portfolio.links ?? {}).filter(([, url]) => url)
  const educationLine = education
    ? [education.fieldOfStudy, education.studyLevel].filter(Boolean).join(', ')
    : ''

  return (
    <div className="portfolio-preview__body">
      <span className="portfolio-avatar" aria-hidden="true">
        {initials(portfolio.displayName)}
      </span>
      <p>Portfolio</p>
      <h2>{portfolio.displayName || 'Your Name'}</h2>
      {portfolio.headline && <h3>{portfolio.headline}</h3>}
      {links.length > 0 && (
        <div className="portfolio-links">
          {links.map(([key, url]) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer nofollow">
              {LINK_LABELS[key]} <ExternalLink size={13} aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
      {portfolio.about && <p className="portfolio-about">{portfolio.about}</p>}
      {portfolio.skills.length > 0 && <SkillTags skills={portfolio.skills} />}

      {morrowWork?.length > 0 && (
        <div className="portfolio-preview__section">
          <span>Verified work on Morrow</span>
          {morrowWork.map((work) => (
            <div className="portfolio-verified" key={work.id}>
              <strong>{work.title}</strong>
              <p>
                <BadgeCheck size={14} aria-hidden="true" /> Completed for {work.companyName}
                {work.completedAt ? ` · ${new Date(work.completedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      <EntryList title="Projects" entries={projects} />
      <EntryList title="Experience" entries={experience} />

      {education && (education.institution || educationLine) && (
        <div className="portfolio-preview__line">
          <span>Education</span>
          <strong>{[educationLine, education.institution].filter(Boolean).join(' – ')}</strong>
          {education.graduationYear && (
            <small>
              {education.graduationYear === 'Already graduated'
                ? 'Graduated'
                : `Graduating ${education.graduationYear}`}
            </small>
          )}
        </div>
      )}
    </div>
  )
}

let nextEntryKey = 0
const newEntry = (kind) => ({
  _key: `new-${(nextEntryKey += 1)}`,
  kind,
  title: '',
  organisation: '',
  role: '',
  startDate: '',
  endDate: '',
  description: '',
  url: '',
  hidden: false,
})

export function PortfolioBuilderPage() {
  const [portfolio, setPortfolio] = useState(null)
  const [skillsText, setSkillsText] = useState('')
  const [education, setEducation] = useState(null)
  const [morrowWork, setMorrowWork] = useState([])
  const [savedSlug, setSavedSlug] = useState(null)
  const [savedPublished, setSavedPublished] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { apiFetch } = useAuth()

  const applyResponse = (data) => {
    setPortfolio(data.portfolio)
    setSkillsText(data.portfolio.skills.join(', '))
    setEducation(data.education)
    setMorrowWork(data.morrowWork)
    setSavedSlug(data.saved ? data.portfolio.slug : null)
    setSavedPublished(data.saved && data.portfolio.published)
    setUpdatedAt(data.updatedAt)
  }

  useEffect(() => {
    let active = true
    apiFetch('/api/candidate/portfolio')
      .then((data) => { if (active) applyResponse(data) })
      .catch((error) => { if (active) toast(`Could not load your portfolio: ${error.message}`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !portfolio) {
    return (
      <main id="main-content" className="product-page loading-page">
        <div className="morrow-loader"></div>
        <p className="loading-text">{loading ? 'Loading your portfolio...' : 'Your portfolio could not be loaded.'}</p>
      </main>
    )
  }

  const update = (changes) => setPortfolio((current) => ({ ...current, ...changes }))
  const updateEntry = (index, changes) =>
    update({ entries: portfolio.entries.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)) })
  const moveEntry = (index, offset) => {
    const entries = [...portfolio.entries]
    const [entry] = entries.splice(index, 1)
    entries.splice(index + offset, 0, entry)
    update({ entries })
  }

  const save = async (event) => {
    event?.preventDefault()
    setSaving(true)
    try {
      const data = await apiFetch('/api/candidate/portfolio', {
        method: 'PUT',
        body: JSON.stringify({ portfolio: { ...portfolio, skills: splitSkills(skillsText) } }),
      })
      applyResponse(data)
      toast(data.portfolio.published ? 'Portfolio saved and published.' : 'Portfolio saved. It is private until you publish it.')
    } catch (error) {
      toast(`Could not save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portfolioUrl(savedSlug))
      toast('Link copied.')
    } catch {
      toast(portfolioUrl(savedSlug))
    }
  }

  const preview = { ...portfolio, skills: splitSkills(skillsText) }

  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="CV and portfolio builder"
        title="Turn your work into a story."
        copy="Build a clean portfolio from your resume details, your own projects and experience, and work you completed on Morrow."
        tone="ink"
      >
        <StatusPill tone={savedPublished ? 'sage' : 'blue'}>
          {savedPublished ? 'Published' : updatedAt ? 'Private draft' : 'Not saved yet'}
        </StatusPill>
      </PageIntro>
      <div className="page-container module-page">
        <div className="portfolio-builder">
          <form className="portfolio-controls" onSubmit={save}>
            <p className="eyebrow">Profile details</p>
            <h2>Shape your page</h2>
            <label className="form-field">
              <span>Display name</span>
              <input
                required
                maxLength={80}
                value={portfolio.displayName}
                onChange={(event) => update({ displayName: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Headline</span>
              <textarea
                rows="2"
                maxLength={160}
                placeholder="e.g. Information Systems student who loves turning data into decisions"
                value={portfolio.headline}
                onChange={(event) => update({ headline: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>About me</span>
              <textarea
                rows="4"
                maxLength={2000}
                value={portfolio.about}
                onChange={(event) => update({ about: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Skills (comma separated)</span>
              <input
                value={skillsText}
                placeholder="e.g. SQL, Power BI, Figma"
                onChange={(event) => setSkillsText(event.target.value)}
              />
            </label>

            <fieldset>
              <legend>Links</legend>
              {Object.entries(LINK_LABELS).map(([key, label]) => (
                <label className="form-field" key={key}>
                  <span>{label}</span>
                  <input
                    type="url"
                    inputMode="url"
                    maxLength={200}
                    placeholder={key === 'website' ? 'https://your-site.com' : `https://${key}.com/...`}
                    value={portfolio.links[key]}
                    onChange={(event) => update({ links: { ...portfolio.links, [key]: event.target.value } })}
                  />
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Projects and experience</legend>
              {portfolio.entries.length === 0 && (
                <p className="portfolio-hint">Add the work you are proud of: class projects, freelance work, jobs, volunteering.</p>
              )}
              {portfolio.entries.map((entry, index) => (
                <div className={`portfolio-entry-editor${entry.hidden ? ' is-hidden' : ''}`} key={entry.id || entry._key}>
                  <div className="portfolio-entry-editor__bar">
                    <select
                      aria-label="Entry type"
                      value={entry.kind}
                      onChange={(event) => updateEntry(index, { kind: event.target.value })}
                    >
                      <option value="project">Project</option>
                      <option value="experience">Experience</option>
                    </select>
                    <button type="button" className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => moveEntry(index, -1)}>
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Move down"
                      disabled={index === portfolio.entries.length - 1}
                      onClick={() => moveEntry(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={entry.hidden ? 'Show on portfolio' : 'Hide from portfolio'}
                      aria-pressed={entry.hidden}
                      onClick={() => updateEntry(index, { hidden: !entry.hidden })}
                    >
                      {entry.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove entry"
                      onClick={() => update({ entries: portfolio.entries.filter((_, i) => i !== index) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="form-field">
                    <span>Title</span>
                    <input required maxLength={120} value={entry.title} onChange={(event) => updateEntry(index, { title: event.target.value })} />
                  </label>
                  <div className="portfolio-entry-editor__pair">
                    <label className="form-field">
                      <span>{entry.kind === 'experience' ? 'Organisation' : 'For (optional)'}</span>
                      <input maxLength={120} value={entry.organisation} onChange={(event) => updateEntry(index, { organisation: event.target.value })} />
                    </label>
                    <label className="form-field">
                      <span>Your role</span>
                      <input maxLength={80} value={entry.role} onChange={(event) => updateEntry(index, { role: event.target.value })} />
                    </label>
                    <label className="form-field">
                      <span>From</span>
                      <input maxLength={30} placeholder="e.g. Feb 2025" value={entry.startDate} onChange={(event) => updateEntry(index, { startDate: event.target.value })} />
                    </label>
                    <label className="form-field">
                      <span>To</span>
                      <input maxLength={30} placeholder="e.g. Present" value={entry.endDate} onChange={(event) => updateEntry(index, { endDate: event.target.value })} />
                    </label>
                  </div>
                  <label className="form-field">
                    <span>What did you do?</span>
                    <textarea rows="3" maxLength={1500} value={entry.description} onChange={(event) => updateEntry(index, { description: event.target.value })} />
                  </label>
                  <label className="form-field">
                    <span>Link (optional)</span>
                    <input type="url" inputMode="url" maxLength={200} placeholder="https://" value={entry.url} onChange={(event) => updateEntry(index, { url: event.target.value })} />
                  </label>
                </div>
              ))}
              <div className="portfolio-entry-add">
                <button type="button" className="button button--outline" onClick={() => update({ entries: [...portfolio.entries, newEntry('project')] })}>
                  <Plus size={16} /> Add project
                </button>
                <button type="button" className="button button--outline" onClick={() => update({ entries: [...portfolio.entries, newEntry('experience')] })}>
                  <Plus size={16} /> Add experience
                </button>
              </div>
            </fieldset>

            <fieldset>
              <legend>Include sections</legend>
              <label className="check-row">
                <input type="checkbox" checked={portfolio.showEducation} onChange={(event) => update({ showEducation: event.target.checked })} />
                <span>Education (from your resume details)</span>
              </label>
              {!education && (
                <p className="portfolio-hint">
                  No education added yet. <Link to="/candidates/resume">Add it on your resume page.</Link>
                </p>
              )}
              <label className="check-row">
                <input type="checkbox" checked={portfolio.showMorrowWork} onChange={(event) => update({ showMorrowWork: event.target.checked })} />
                <span>Verified Morrow projects ({morrowWork.length})</span>
              </label>
              {morrowWork.length === 0 && (
                <p className="portfolio-hint">
                  Projects appear here once an employer marks your work on a <Link to="/projects">Morrow project</Link> as completed.
                </p>
              )}
            </fieldset>

            <fieldset>
              <legend>Sharing</legend>
              <label className="form-field">
                <span>Your link</span>
                <div className="portfolio-slug">
                  <small>/portfolio/</small>
                  <input
                    required
                    maxLength={40}
                    pattern="[a-z0-9](?:[a-z0-9\-]{1,38}[a-z0-9])"
                    title="3 to 40 lowercase letters, numbers or dashes"
                    value={portfolio.slug}
                    onChange={(event) => update({ slug: event.target.value.toLowerCase() })}
                  />
                </div>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={portfolio.published} onChange={(event) => update({ published: event.target.checked })} />
                <span>Publish my portfolio (anyone with the link can view it)</span>
              </label>
              {savedPublished && savedSlug && (
                <div className="portfolio-controls__link">
                  <Link2 size={17} aria-hidden="true" />
                  <a href={`/portfolio/${savedSlug}`} target="_blank" rel="noopener noreferrer">
                    {portfolioUrl(savedSlug)}
                  </a>
                  <button type="button" className="icon-button" aria-label="Copy link" onClick={copyLink}>
                    <Copy size={16} />
                  </button>
                </div>
              )}
            </fieldset>

            <div className="portfolio-actions">
              <button className="button button--dark" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save portfolio'}
              </button>
              <button className="button button--outline" type="button" onClick={() => window.print()}>
                <Download size={16} aria-hidden="true" /> Download as PDF
              </button>
            </div>
            <PreviewNotice>
              Download as PDF opens your browser&apos;s print window — choose &quot;Save as PDF&quot; as the printer.
            </PreviewNotice>
          </form>

          <section className="portfolio-preview portfolio-print" aria-label="Portfolio page preview">
            <div className="portfolio-preview__browser">
              <span />
              <span />
              <span />
              <small>/portfolio/{portfolio.slug}</small>
            </div>
            <PortfolioView
              portfolio={preview}
              education={portfolio.showEducation ? education : null}
              morrowWork={portfolio.showMorrowWork ? morrowWork : []}
            />
          </section>
        </div>
      </div>
    </main>
  )
}

export function PublicPortfolioPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/portfolios/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active) setData(body) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  if (loading) {
    return (
      <main id="main-content" className="product-page loading-page">
        <div className="morrow-loader"></div>
        <p className="loading-text">Loading portfolio...</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main id="main-content" className="product-page">
        <div className="page-container">
          <p>This portfolio is not available. It may be private or the link may be wrong.</p>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="product-page">
      <div className="page-container portfolio-public">
        <div className="portfolio-actions">
          <button className="button button--outline" type="button" onClick={() => window.print()}>
            <Download size={16} aria-hidden="true" /> Download as PDF
          </button>
        </div>
        <section className="portfolio-preview portfolio-print" aria-label={`${data.displayName}'s portfolio`}>
          <PortfolioView portfolio={{ ...data, entries: data.entries }} education={data.education} morrowWork={data.morrowWork} />
        </section>
      </div>
    </main>
  )
}
