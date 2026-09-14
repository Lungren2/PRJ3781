import { useState } from 'react'
import { ArrowRight, ArrowUpRight, MapPin, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import heroImage from '../assets/morrow-hero.png'
import { jobs } from '../data/mockData.js'
import { useToast } from '../components/ToastContext.jsx'

function HeroSearch() {
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const navigate = useNavigate()

  return (
    <form
      className="hero-search"
      aria-label="Search opportunities"
      onSubmit={(event) => {
        event.preventDefault()
        const params = new URLSearchParams()
        if (keyword) params.set('query', keyword)
        if (location) params.set('location', location)
        navigate(`/jobs${params.size ? `?${params.toString()}` : ''}`)
      }}
    >
      <label className="search-field">
        <span>Role or keyword</span>
        <span className="search-field__input">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Marketing, data, design"
          />
        </span>
      </label>
      <label className="search-field">
        <span>Location</span>
        <span className="search-field__input">
          <MapPin size={18} aria-hidden="true" />
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="City or remote"
          />
        </span>
      </label>
      <button className="button button--dark hero-search__submit" type="submit">
        Browse opportunities <ArrowUpRight size={18} aria-hidden="true" />
      </button>
    </form>
  )
}

function OpportunityRow({ job }) {
  const toast = useToast()

  return (
    <article className="opportunity-row">
      <div className={`company-mark company-mark--${job.tone}`} aria-hidden="true">
        {job.mark}
      </div>
      <div className="opportunity-row__role">
        <h3>{job.title}</h3>
        <p>{job.company}</p>
      </div>
      <div className="opportunity-row__location">
        <p>{job.location}</p>
        <span>{job.mode}</span>
      </div>
      <span className={`role-tag role-tag--${job.type === 'Internship' ? 'sage' : 'blue'}`}>
        {job.type}
      </span>
      <button
        className="role-link"
        type="button"
        onClick={() => toast('The job detail page will connect here later.')}
      >
        View role <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </article>
  )
}

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__note">Student opportunities, minus the noise.</p>
          <h1>
            Find what <br />
            comes next.
          </h1>
          <p className="hero__copy">
            Discover jobs, practical projects, and learning made for your first steps into working
            life.
          </p>
          <HeroSearch />
          <p className="hero__fine-print">Frontend preview - sample listings only</p>
        </div>
        <div className="hero__media">
          <img
            src={heroImage}
            alt="Three students sharing a relaxed moment in a colourful studio"
            fetchpriority="high"
          />
          <div className="hero__media-label">
            <span>For students</span>
            <span>For graduates</span>
          </div>
        </div>
      </section>

      <div className="discipline-strip" aria-label="Opportunity categories">
        <span>Internships</span>
        <i aria-hidden="true" />
        <span>Entry-level roles</span>
        <i aria-hidden="true" />
        <span>Part-time work</span>
        <i aria-hidden="true" />
        <span>Hackathons</span>
        <i aria-hidden="true" />
        <span>Student projects</span>
      </div>

      <section className="opportunities" aria-labelledby="opportunities-title">
        <div className="section-heading">
          <div>
            <p>Sample listings</p>
            <h2 id="opportunities-title">Fresh opportunities</h2>
          </div>
          <Link className="inline-link" to="/jobs">
            View all jobs <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="opportunity-list">
          {jobs.slice(0, 5).map((job) => (
            <OpportunityRow key={job.id} job={job} />
          ))}
        </div>
      </section>

      <section className="graduates" aria-labelledby="graduates-title">
        <div className="graduates__copy">
          <h2 id="graduates-title">Your first move deserves a better starting point.</h2>
          <p>
            Morrow brings early-career work, skill building, hackathons, and practical projects into
            one focused place.
          </p>
          <Link className="button button--white" to="/candidates">
            Explore candidate tools <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="portal" aria-hidden="true">
          <span className="portal__circle" />
          <span className="portal__door" />
          <span className="portal__brand">
            <img src="/morrow-mark.svg" alt="" />
            <strong>Morrow</strong>
          </span>
        </div>
      </section>

      <section className="about" aria-labelledby="about-title">
        <p className="about__statement" id="about-title">
          Less scrolling past paths that were never meant for you. More clarity about where to
          begin.
        </p>
        <div className="about__details">
          <p>
            Students can browse work and experience. Employers can preview talent sourcing,
            screening, analytics, and brand-event tools.
          </p>
          <p>
            This release is intentionally a visual shell. Profiles, applications, crawlers, uploads,
            and analytics will connect to backend services later.
          </p>
        </div>
      </section>
    </main>
  )
}
