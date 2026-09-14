import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteLayout } from './components/SiteChrome.jsx'
import HomePage from './pages/HomePage.jsx'
import { JobsPage, RecommendedJobsPage } from './pages/JobsPages.jsx'
import { CandidateHubPage, ResumePage } from './pages/CandidatePages.jsx'
import { BrowseCandidatesPage, EmployerHubPage, PostJobPage } from './pages/EmployerPages.jsx'
import {
  CertificationsPage,
  CoursesPage,
  HackathonsPage,
  JobCrawlerPage,
  PortfolioBuilderPage,
  ProjectsPage,
} from './pages/DiscoveryPages.jsx'
import { AccessDeniedPage, AuthPage, NotFoundPage } from './pages/UtilityPages.jsx'
import { ToastContext } from './components/ToastContext.jsx'
import { AuthProvider, RequireCandidate, RequireEmployer } from './components/AuthContext.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="candidates" element={<CandidateHubPage />} />
        <Route path="candidates/resume" element={<RequireCandidate><ResumePage /></RequireCandidate>} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/part-time" element={<JobsPage preset="Part-time" />} />
        <Route path="jobs/internships" element={<JobsPage preset="Internship" />} />
        <Route path="jobs/entry-level" element={<JobsPage preset="Entry level" />} />
        <Route path="jobs/recommended" element={<RequireCandidate><RecommendedJobsPage /></RequireCandidate>} />
        <Route path="employers" element={<EmployerHubPage />} />
        <Route path="employers/candidates" element={<RequireEmployer><BrowseCandidatesPage /></RequireEmployer>} />
        <Route path="employers/post-job" element={<RequireEmployer><PostJobPage /></RequireEmployer>} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="discover/jobs" element={<JobCrawlerPage />} />
        <Route path="discover/hackathons" element={<HackathonsPage />} />
        <Route path="discover/certifications" element={<CertificationsPage />} />
        <Route path="portfolio-builder" element={<PortfolioBuilderPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="forbidden" element={<AccessDeniedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  const [message, setMessage] = useState('')

  const showToast = useCallback((nextMessage) => {
    setMessage(nextMessage)
    window.clearTimeout(window.__morrowToastTimer)
    window.__morrowToastTimer = window.setTimeout(() => setMessage(''), 3600)
  }, [])

  const toastValue = useMemo(() => showToast, [showToast])

  return (
    <ToastContext.Provider value={toastValue}>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AppRoutes />
          <div className={`toast${message ? ' toast--visible' : ''}`} role="status" aria-live="polite">
            {message}
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastContext.Provider>
  )
}

export default App
