import express from 'express'
import { requireCandidate, requireCsrf } from '../auth/middleware.js'
import {
  findPortfolioBySlug,
  getPortfolioForUser,
  isSlugTaken,
  savePortfolio,
} from '../db/portfolioRepository.js'
import { listCompletedProjectsForUser } from '../db/productRepository.js'
import { getResumeForUser } from '../db/resumeRepository.js'
import { PORTFOLIO_ENTRY_KINDS } from '../models/Portfolio.js'

export const portfolioRouter = express.Router()

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
const MAX_ENTRIES = 30
const MAX_SKILLS = 20
const LINK_KEYS = ['linkedin', 'github', 'website']
const TEXT_LIMITS = { displayName: 80, headline: 160, about: 2000 }
const ENTRY_LIMITS = { title: 120, organisation: 120, role: 80, startDate: 30, endDate: 30, description: 1500 }

const text = (value) => (typeof value === 'string' ? value.trim() : '')

// Only http(s) links are allowed, so a portfolio can never carry a javascript: URL.
function cleanUrl(value, label) {
  const raw = text(value)
  if (!raw) return { url: '' }
  if (raw.length > 200) return { error: `${label} must be at most 200 characters` }
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if (!['http:', 'https:'].includes(url.protocol)) return { error: `${label} must be a web link` }
    return { url: url.href }
  } catch {
    return { error: `${label} is not a valid link` }
  }
}

export function slugify(name) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 34)
    .replace(/-+$/g, '')
  return slug.length >= 3 ? slug : `portfolio-${slug || 'me'}`.slice(0, 34)
}

/**
 * Validate the whole portfolio as sent by the builder.
 */
export function validatePortfolio(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'portfolio must be an object' }
  const portfolio = {}

  const slug = text(input.slug).toLowerCase()
  if (!SLUG_PATTERN.test(slug)) {
    return { error: 'link name must be 3 to 40 letters, numbers or dashes, starting and ending with a letter or number' }
  }
  portfolio.slug = slug

  for (const key of ['published', 'showEducation', 'showMorrowWork']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') return { error: `${key} must be true or false` }
    portfolio[key] = input[key] ?? (key !== 'published')
  }

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (input[key] !== undefined && input[key] !== null && typeof input[key] !== 'string') {
      return { error: `${key} must be text` }
    }
    const value = text(input[key])
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` }
    portfolio[key] = value
  }
  if (!portfolio.displayName) return { error: 'display name is required' }

  const skillList = Array.isArray(input.skills) ? input.skills : String(input.skills ?? '').split(',')
  const skills = [...new Set(skillList.map(text).filter(Boolean))]
  if (skills.length > MAX_SKILLS) return { error: `add at most ${MAX_SKILLS} skills` }
  if (skills.some((skill) => skill.length > 40)) return { error: 'each skill must be at most 40 characters' }
  portfolio.skills = skills

  portfolio.links = {}
  for (const key of LINK_KEYS) {
    const { url, error } = cleanUrl(input.links?.[key], key)
    if (error) return { error }
    portfolio.links[key] = url
  }

  const entries = input.entries ?? []
  if (!Array.isArray(entries)) return { error: 'entries must be a list' }
  if (entries.length > MAX_ENTRIES) return { error: `add at most ${MAX_ENTRIES} entries` }
  portfolio.entries = []
  for (const [index, entry] of entries.entries()) {
    const label = `entry ${index + 1}`
    if (!entry || typeof entry !== 'object') return { error: `${label} is not valid` }
    if (!PORTFOLIO_ENTRY_KINDS.includes(entry.kind)) return { error: `${label} must be a project or experience` }
    const clean = { kind: entry.kind, hidden: entry.hidden === true }
    for (const [key, limit] of Object.entries(ENTRY_LIMITS)) {
      const value = text(entry[key])
      if (value.length > limit) return { error: `${label}: ${key} must be at most ${limit} characters` }
      clean[key] = value
    }
    if (!clean.title) return { error: `${label} needs a title` }
    const { url, error } = cleanUrl(entry.url, `${label} link`)
    if (error) return { error }
    clean.url = url
    portfolio.entries.push(clean)
  }
  return { portfolio }
}

async function educationFor(userId) {
  const profile = (await getResumeForUser(userId))?.profile ?? {}
  const education = {
    studyLevel: profile.studyLevel ?? '',
    institution: profile.institution ?? '',
    fieldOfStudy: profile.fieldOfStudy ?? '',
    graduationYear: profile.graduationYear ?? '',
  }
  return Object.values(education).some(Boolean) ? education : null
}

function entryResponse(entry) {
  return {
    id: entry._id ? String(entry._id) : undefined,
    kind: entry.kind,
    title: entry.title ?? '',
    organisation: entry.organisation ?? '',
    role: entry.role ?? '',
    startDate: entry.startDate ?? '',
    endDate: entry.endDate ?? '',
    description: entry.description ?? '',
    url: entry.url ?? '',
    hidden: Boolean(entry.hidden),
  }
}

async function suggestSlug(name) {
  const base = slugify(name)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    if (!(await isSlugTaken(candidate))) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

// The candidate's own view: everything, including hidden entries and the publish state.
async function ownerResponse(user) {
  const [portfolio, education, morrowWork] = await Promise.all([
    getPortfolioForUser(user.id),
    educationFor(user.id),
    listCompletedProjectsForUser(user.id),
  ])
  return {
    saved: Boolean(portfolio),
    portfolio: {
      slug: portfolio?.slug ?? (await suggestSlug(user.displayName)),
      published: portfolio?.published ?? false,
      displayName: portfolio?.displayName ?? user.displayName,
      headline: portfolio?.headline ?? '',
      about: portfolio?.about ?? '',
      skills: portfolio?.skills ?? [],
      links: {
        linkedin: portfolio?.links?.linkedin ?? '',
        github: portfolio?.links?.github ?? '',
        website: portfolio?.links?.website ?? '',
      },
      showEducation: portfolio?.showEducation ?? true,
      showMorrowWork: portfolio?.showMorrowWork ?? true,
      entries: (portfolio?.entries ?? []).map(entryResponse),
    },
    education,
    morrowWork,
    updatedAt: portfolio?.updatedAt ?? null,
  }
}

portfolioRouter.get('/candidate/portfolio', requireCandidate, async (req, res, next) => {
  try {
    res.json(await ownerResponse(req.user))
  } catch (error) {
    next(error)
  }
})

portfolioRouter.put('/candidate/portfolio', requireCandidate, requireCsrf, async (req, res, next) => {
  const { portfolio, error } = validatePortfolio(req.body?.portfolio)
  if (error) return res.status(400).json({ error })
  try {
    if (await isSlugTaken(portfolio.slug, req.user.id)) {
      return res.status(409).json({ error: 'that link name is already taken' })
    }
    await savePortfolio(req.user.id, portfolio)
    res.json(await ownerResponse(req.user))
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'that link name is already taken' })
    next(err)
  }
})

// Public page. Unpublished portfolios look exactly like missing ones.
portfolioRouter.get('/portfolios/:slug', async (req, res, next) => {
  try {
    const portfolio = await findPortfolioBySlug(String(req.params.slug).toLowerCase())
    if (!portfolio?.published) return res.status(404).json({ error: 'portfolio not found' })
    const [education, morrowWork] = await Promise.all([
      portfolio.showEducation ? educationFor(portfolio.user) : null,
      portfolio.showMorrowWork ? listCompletedProjectsForUser(portfolio.user) : [],
    ])
    res.set('cache-control', 'no-store')
    res.json({
      slug: portfolio.slug,
      displayName: portfolio.displayName,
      headline: portfolio.headline ?? '',
      about: portfolio.about ?? '',
      skills: portfolio.skills ?? [],
      links: portfolio.links ?? {},
      education,
      morrowWork,
      entries: (portfolio.entries ?? []).filter((entry) => !entry.hidden).map(entryResponse),
      updatedAt: portfolio.updatedAt,
    })
  } catch (error) {
    next(error)
  }
})
