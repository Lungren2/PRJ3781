import { config } from '../config.js'
import { classifySkills, normalizeLevel, truncate } from '../normalize/taxonomy.js'
import { getCursor, setCursor } from '../db/repository.js'

export const id = 'coursera'
export const displayName = 'Coursera'
export const host = 'api.coursera.org'

const FIELDS = 'name,slug,description,workload,primaryLanguages,photoUrl,courseType,domainTypes'
const BASE = 'https://api.coursera.org/api/courses.v1'

/**
 * api.coursera.org/robots.txt carries `Disallow: /api/` for `User-agent: *`, while
 * courses.v1 is Coursera's documented public catalog API, published for programmatic
 * access. We consume it as an API client rather than crawling their website, and the
 * robots gate is skipped for this host only. COURSERA_USE_CATALOG_API=0 disables the
 * provider entirely for a strict-robots posture.
 */
export const skipRobots = true

export function enabled() {
  const settings = config.providers.coursera
  if (!settings.enabled) return false
  if (!settings.useCatalogApi) {
    console.warn(
      '[coursera] COURSERA_USE_CATALOG_API=0 — skipping provider (strict robots posture)',
    )
    return false
  }
  return true
}

const COURSE_TYPE_MAP = {
  'v2.ondemand': 'course',
  'v1.ondemand': 'course',
  'v1.session': 'course',
  guidedproject: 'guided-project',
  rhyme: 'guided-project',
}

function normalizeCourseType(courseType, slug) {
  const key = String(courseType ?? '').toLowerCase()
  if (COURSE_TYPE_MAP[key]) return COURSE_TYPE_MAP[key]
  if (key.includes('guided') || key.includes('project')) return 'guided-project'
  if (String(slug ?? '').startsWith('projects-')) return 'guided-project'
  return 'course'
}

function toRecord(entry) {
  // English-only for now: the page audience is English and we cannot classify
  // skills reliably from titles in languages the keyword lists do not cover.
  const languages = entry.primaryLanguages ?? []
  if (languages.length > 0 && !languages.some((lang) => String(lang).startsWith('en'))) return null
  if (!entry.slug || !entry.name) return null

  const tags = (entry.domainTypes ?? [])
    .flatMap((domain) => [domain.domainId, domain.subdomainId])
    .filter(Boolean)
  const description = truncate(entry.description ?? '')
  const skills = classifySkills({ title: entry.name, description, tags })
  // Coursera's catalogue is 23k records wide and mostly not technical. Anything that
  // maps to no skill is dropped rather than stored as noise.
  if (skills.length === 0) return null

  return {
    provider: id,
    providerName: displayName,
    externalId: entry.id,
    url: `https://www.coursera.org/learn/${entry.slug}`,
    title: entry.name,
    description,
    type: normalizeCourseType(entry.courseType, entry.slug),
    level: normalizeLevel(null, { title: entry.name, description }),
    duration: entry.workload || null,
    format: 'Self-paced',
    imageUrl: entry.photoUrl ?? null,
    skills,
    raw: entry,
  }
}

/**
 * Paginated. The cursor is persisted so a run truncated by a budget resumes where it
 * stopped instead of re-walking the catalogue from the beginning.
 */
export async function* crawl(
  ctx,
  { maxPages = config.crawl.maxPagesPerProvider, resume = true } = {},
) {
  const pageSize = config.providers.coursera.pageSize
  let start = resume ? Number(getCursor(id) ?? 0) : 0
  let pages = 0

  while (pages < maxPages) {
    const url = `${BASE}?start=${start}&limit=${pageSize}&fields=${FIELDS}`
    const { data } = await ctx.fetchJson(url, { skipRobots })

    const elements = data.elements ?? []
    for (const entry of elements) {
      const record = toRecord(entry)
      if (record) yield record
    }

    pages += 1
    const next = data.paging?.next

    if (!next || elements.length === 0) {
      // Reached the end of the catalogue: reset so the next run starts fresh.
      setCursor(id, '0')
      return { completePass: true }
    }

    start = Number(next)
    setCursor(id, String(start))
  }

  return { completePass: false }
}
