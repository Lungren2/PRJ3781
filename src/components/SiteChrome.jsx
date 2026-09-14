import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  GraduationCap,
  Instagram,
  Linkedin,
  LogIn,
  Mail,
  Menu,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useToast } from './ToastContext.jsx'

const candidateLinks = [
  {
    label: 'Candidate home',
    description: 'Your early-career workspace',
    to: '/candidates',
    icon: Compass,
  },
  {
    label: 'Upload resume',
    description: 'Prepare your matching profile',
    to: '/candidates/resume',
    icon: FileText,
  },
  {
    label: 'Browse part-time',
    description: 'Flexible work alongside studies',
    to: '/jobs/part-time',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Browse internships',
    description: 'Build structured experience',
    to: '/jobs/internships',
    icon: GraduationCap,
  },
  {
    label: 'Entry-level jobs',
    description: 'Find your first full-time role',
    to: '/jobs/entry-level',
    icon: Sparkles,
  },
  {
    label: 'Recommended jobs',
    description: 'See roles shaped around you',
    to: '/jobs/recommended',
    icon: Compass,
  },
]

const employerLinks = [
  {
    label: 'Employer home',
    description: 'Explore the hiring workspace',
    to: '/employers',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Browse candidates',
    description: 'Discover early-career talent',
    to: '/employers/candidates',
    icon: Users,
  },
  {
    label: 'Post a job',
    description: 'Create a clear role brief',
    to: '/employers/post-job',
    icon: FileText,
  },
]

const exploreLinks = [
  {
    label: 'Hackathons',
    description: 'Build, compete, and collaborate',
    to: '/discover/hackathons',
    icon: Sparkles,
  },
  {
    label: 'Certifications',
    description: 'Explore useful credentials',
    to: '/discover/certifications',
    icon: GraduationCap,
  },
  {
    label: 'Courses',
    description: 'Learn practical career skills',
    to: '/courses',
    icon: BookOpen,
  },
  {
    label: 'Portfolio builder',
    description: 'Turn your work into a story',
    to: '/portfolio-builder',
    icon: FileText,
  },
  {
    label: 'Student projects',
    description: 'Take on real-world briefs',
    to: '/projects',
    icon: Compass,
  },
]

export function Logo({ inverse = false }) {
  return (
    <Link className="logo" to="/" aria-label="Morrow home">
      <img
        className="logo__mark"
        src={inverse ? '/morrow-mark-inverse.svg' : '/morrow-mark.svg'}
        alt=""
        aria-hidden="true"
      />
      <span className="logo__word">Morrow</span>
    </Link>
  )
}

function NavMenu({ label, links, active, open, onToggle, onNavigate, triggerRef }) {
  return (
    <div className={`nav-dropdown${active ? ' nav-dropdown--active' : ''}`}>
      <button
        className="nav-dropdown__trigger"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        ref={triggerRef}
      >
        {label}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-dropdown__panel">
          {links.map(({ label: linkLabel, description, to, icon: Icon }) => (
            <Link key={to} to={to} onClick={onNavigate}>
              <span className="nav-dropdown__icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="nav-dropdown__link-copy">
                <strong>{linkLabel}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileGroup({ title, links, onNavigate }) {
  return (
    <section className="mobile-nav-group">
      <p>{title}</p>
      {links.map(({ label, to }) => (
        <Link key={to} to={to} onClick={onNavigate}>
          {label}
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      ))}
    </section>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDesktopMenu, setOpenDesktopMenu] = useState('')
  const location = useLocation()
  const headerRef = useRef(null)
  const candidateTriggerRef = useRef(null)
  const employerTriggerRef = useRef(null)
  const exploreTriggerRef = useRef(null)

  useEffect(() => {
    setMenuOpen(false)
    setOpenDesktopMenu('')
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('menu-is-open', menuOpen)
    return () => document.body.classList.remove('menu-is-open')
  }, [menuOpen])

  useEffect(() => {
    const closeOnPointerDown = (event) => {
      if (openDesktopMenu && !headerRef.current?.contains(event.target)) setOpenDesktopMenu('')
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || !openDesktopMenu) return
      const triggerMap = {
        candidates: candidateTriggerRef,
        employers: employerTriggerRef,
        explore: exploreTriggerRef,
      }
      setOpenDesktopMenu('')
      triggerMap[openDesktopMenu]?.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openDesktopMenu])

  return (
    <>
      <div className="preview-bar">
        <div className="preview-bar__inner">
          <p>Frontend project preview - sample data only.</p>
          <Link to="/jobs">
            Browse active jobs <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <header className="site-header" ref={headerRef}>
        <div className="site-header__inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Primary navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavMenu
              label="For candidates"
              links={candidateLinks}
              active={location.pathname.startsWith('/candidates')}
              open={openDesktopMenu === 'candidates'}
              onToggle={() =>
                setOpenDesktopMenu((current) => (current === 'candidates' ? '' : 'candidates'))
              }
              onNavigate={() => setOpenDesktopMenu('')}
              triggerRef={candidateTriggerRef}
            />
            <NavMenu
              label="For employers"
              links={employerLinks}
              active={location.pathname.startsWith('/employers')}
              open={openDesktopMenu === 'employers'}
              onToggle={() =>
                setOpenDesktopMenu((current) => (current === 'employers' ? '' : 'employers'))
              }
              onNavigate={() => setOpenDesktopMenu('')}
              triggerRef={employerTriggerRef}
            />
            <NavMenu
              label="Explore"
              links={exploreLinks}
              active={['/courses', '/discover', '/portfolio-builder', '/projects'].some((path) =>
                location.pathname.startsWith(path),
              )}
              open={openDesktopMenu === 'explore'}
              onToggle={() =>
                setOpenDesktopMenu((current) => (current === 'explore' ? '' : 'explore'))
              }
              onNavigate={() => setOpenDesktopMenu('')}
              triggerRef={exploreTriggerRef}
            />
            <NavLink className="nav-jobs-link" to="/jobs">
              <BriefcaseBusiness size={16} aria-hidden="true" /> Jobs
            </NavLink>
          </nav>
          <div className="header-actions">
            <div className="desktop-auth desktop-only" aria-label="Account actions">
              <Link className="button button--login" to="/auth?mode=login">
                <LogIn size={16} aria-hidden="true" /> Log in
              </Link>
              <Link className="button button--signup" to="/auth?mode=signup">
                Sign up <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {!menuOpen && (
              <Link className="button button--signup mobile-signup" to="/auth?mode=signup">
                Sign up
              </Link>
            )}
            <button
              className="menu-button"
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mobile-menu${menuOpen ? ' mobile-menu--open' : ''}`}
        id="mobile-navigation"
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Mobile navigation">
          <Link className="mobile-home-link" to="/" onClick={() => setMenuOpen(false)}>
            Home <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <section className="mobile-account-panel" aria-labelledby="mobile-account-title">
            <div className="mobile-account-panel__heading">
              <span>
                <UserRound size={19} aria-hidden="true" />
              </span>
              <div>
                <strong id="mobile-account-title">Your Morrow</strong>
                <small>Save your progress and opportunities</small>
              </div>
            </div>
            <div className="mobile-account-panel__actions">
              <Link
                className="button button--login"
                to="/auth?mode=login"
                onClick={() => setMenuOpen(false)}
              >
                <LogIn size={16} aria-hidden="true" /> Log in
              </Link>
              <Link
                className="button button--signup"
                to="/auth?mode=signup"
                onClick={() => setMenuOpen(false)}
              >
                <UserPlus size={16} aria-hidden="true" /> Sign up
              </Link>
            </div>
          </section>
          <Link className="mobile-jobs-link" to="/jobs" onClick={() => setMenuOpen(false)}>
            <span>
              <BriefcaseBusiness size={18} aria-hidden="true" /> Browse active jobs
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <MobileGroup
            title="For candidates"
            links={candidateLinks}
            onNavigate={() => setMenuOpen(false)}
          />
          <MobileGroup
            title="For employers"
            links={employerLinks}
            onNavigate={() => setMenuOpen(false)}
          />
          <MobileGroup title="Explore" links={exploreLinks} onNavigate={() => setMenuOpen(false)} />
        </nav>
      </div>
    </>
  )
}

function Footer() {
  const [email, setEmail] = useState('')
  const toast = useToast()

  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="footer-brand">
          <Logo inverse />
          <p>
            A focused place for students and graduates to find work, learning, and practical
            experience.
          </p>
          <span>Frontend project shell.</span>
        </div>
        <nav className="footer-nav" aria-label="Explore Morrow">
          <h2>Explore</h2>
          <Link to="/jobs">Active jobs</Link>
          <Link to="/discover/hackathons">Hackathons</Link>
          <Link to="/discover/certifications">Certifications</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/projects">Student projects</Link>
        </nav>
        <div className="footer-contact">
          <h2>Stay in the loop</h2>
          <p>Preview the newsletter interaction. Nothing is sent or stored.</p>
          <form
            className="newsletter"
            onSubmit={(event) => {
              event.preventDefault()
              toast(`Preview saved for ${email}. No data was sent.`)
              setEmail('')
            }}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <Mail size={18} aria-hidden="true" />
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              required
            />
            <button type="submit" aria-label="Preview newsletter sign-up">
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Morrow</p>
        <div className="social-links" aria-label="Social previews">
          <button
            type="button"
            aria-label="Instagram preview"
            onClick={() => toast('Social links are placeholders in this frontend shell.')}
          >
            <Instagram aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="LinkedIn preview"
            onClick={() => toast('Social links are placeholders in this frontend shell.')}
          >
            <Linkedin aria-hidden="true" />
          </button>
        </div>
        <p>Designed for students finding their first move.</p>
      </div>
    </footer>
  )
}

export function SiteLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
