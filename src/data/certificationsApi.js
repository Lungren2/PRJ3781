import { certifications as sampleCertifications } from './mockData.js'

const API_BASE = '/api'
const SNAPSHOT_URL = '/data/certifications.json'

/**
 * Three tiers, best first:
 *   live     - the crawler service is running and answering queries
 *   snapshot - the exported JSON from the last crawl, filtered in the browser
 *   sample   - the original hand-written mock data
 *
 * The page reports which tier it is showing rather than pretending the data is live.
 */
const SOURCE = { live: 'live', snapshot: 'snapshot', sample: 'sample' }

let snapshotPromise = null

function loadSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(SNAPSHOT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`snapshot ${response.status}`)
        return response.json()
      })
      .catch(() => null)
  }
  return snapshotPromise
}

const sampleItems = sampleCertifications.map((certificate, index) => ({
  id: `sample:${index}`,
  title: certificate.title,
  description: null,
  url: null,
  provider: 'sample',
  providerName: certificate.provider,
  type: 'certification',
  level: certificate.level.toLowerCase(),
  duration: certificate.duration,
  format: certificate.format,
  imageUrl: null,
  skills: [],
}))

function matches(item, { skill, type, level, q }) {
  if (skill && !item.skills?.includes(skill)) return false
  if (type && item.type !== type) return false
  if (level && item.level !== level) return false
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase()
    const haystack = `${item.title} ${item.description ?? ''} ${item.providerName}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  return true
}

function toQuery(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  }
  return params.toString()
}

export async function fetchCertifications(
  { skill, type, level, q, page = 1, pageSize = 24 } = {},
  signal,
) {
  const filters = { skill, type, level, q, page, pageSize }

  try {
    const response = await fetch(`${API_BASE}/certifications?${toQuery(filters)}`, { signal })
    if (!response.ok) throw new Error(`api ${response.status}`)
    const data = await response.json()
    return { ...data, source: SOURCE.live }
  } catch (error) {
    if (error.name === 'AbortError') throw error

    const snapshot = await loadSnapshot()
    const pool = snapshot?.items ?? sampleItems
    const source = snapshot ? SOURCE.snapshot : SOURCE.sample
    const filtered = pool.filter((item) => matches(item, filters))
    const start = (page - 1) * pageSize

    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      source,
    }
  }
}

/**
 * Counts are computed per dimension with the *other* active filters applied, so
 * "Networking (18)" means 18 results given the current level and keyword — not 18
 * in the catalogue overall.
 */
export async function fetchFacets({ skill, type, level, q } = {}, signal) {
  try {
    const response = await fetch(
      `${API_BASE}/certifications/facets?${toQuery({ skill, type, level, q })}`,
      { signal },
    )
    if (!response.ok) throw new Error(`api ${response.status}`)
    return { ...(await response.json()), source: SOURCE.live }
  } catch (error) {
    if (error.name === 'AbortError') throw error

    const snapshot = await loadSnapshot()
    if (!snapshot?.items) {
      return { skills: [], types: [], levels: [], total: sampleItems.length, source: SOURCE.sample }
    }

    // Recount against the snapshot so the offline experience matches the live one.
    const countFor = (overrides) =>
      snapshot.items.filter((item) => matches(item, { skill, type, level, q, ...overrides })).length

    const recount = (options, key) =>
      (options ?? []).map((option) => ({ ...option, count: countFor({ [key]: option.id }) }))

    return {
      skills: recount(snapshot.facets?.skills, 'skill'),
      types: recount(snapshot.facets?.types, 'type'),
      levels: recount(snapshot.facets?.levels, 'level'),
      total: countFor({}),
      source: SOURCE.snapshot,
    }
  }
}

export async function fetchHealth(signal) {
  try {
    const response = await fetch(`${API_BASE}/health`, { signal })
    if (!response.ok) throw new Error(`api ${response.status}`)
    return { ...(await response.json()), source: SOURCE.live }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    const snapshot = await loadSnapshot()
    if (snapshot?.health) {
      return { ...snapshot.health, generatedAt: snapshot.generatedAt, source: SOURCE.snapshot }
    }
    return { source: SOURCE.sample }
  }
}

/** "3 hours ago" style formatting for the crawler status strip. */
export function relativeTime(isoString) {
  if (!isoString) return null
  const deltaMs = Date.now() - new Date(isoString).getTime()
  if (!Number.isFinite(deltaMs)) return null

  const minutes = Math.round(deltaMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export { SOURCE }
