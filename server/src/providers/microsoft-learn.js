import { classifySkills, normalizeLevel, stripHtml, truncate } from '../normalize/taxonomy.js'

export const id = 'microsoft-learn'
export const displayName = 'Microsoft Learn'
export const host = 'learn.microsoft.com'

// learn.microsoft.com/robots.txt disallows /api/nextsteps/ and /api/attachments/,
// but not /api/catalog/. No credentials, no key, no grey area.
const CATALOG_URL =
  'https://learn.microsoft.com/api/catalog/?locale=en-us&type=certifications,learningPaths'

export function enabled() {
  return true
}

const CERT_TYPE_MAP = {
  fundamentals: 'certification',
  'role-based': 'certification',
  specialty: 'certification',
}

function toRecord(entry, { type, tags, level }) {
  const description = truncate(stripHtml(entry.subtitle ?? entry.summary ?? ''))
  const title = entry.title
  const skills = classifySkills({ title, description, tags })
  if (skills.length === 0) return null

  return {
    provider: id,
    providerName: displayName,
    externalId: entry.uid,
    // Strip Microsoft's telemetry query param so the outbound link stays clean.
    url: entry.url.split('?')[0],
    title,
    description,
    type,
    level: normalizeLevel(level, { title, description }),
    duration: entry.duration_in_minutes
      ? `${Math.round(entry.duration_in_minutes / 60)} hours`
      : null,
    format: 'Online',
    imageUrl: entry.icon_url ?? null,
    skills,
    raw: entry,
  }
}

/**
 * One request covers the whole Microsoft catalogue, so there is no pagination and
 * nothing to resume. Always scope with `type=` — the unscoped catalogue is >10 MB.
 */
export async function* crawl(ctx) {
  const { data } = await ctx.fetchJson(CATALOG_URL)

  for (const entry of data.certifications ?? []) {
    const record = toRecord(entry, {
      type: CERT_TYPE_MAP[entry.certification_type] ?? 'certification',
      tags: [...(entry.roles ?? []), ...(entry.subjects ?? [])],
      level: entry.levels?.[0],
    })
    if (record) yield record
  }

  for (const entry of data.learningPaths ?? []) {
    const record = toRecord(entry, {
      type: 'learning-path',
      tags: [...(entry.roles ?? []), ...(entry.subjects ?? []), ...(entry.products ?? [])],
      level: entry.levels?.[0],
    })
    if (record) yield record
  }
}

export const completesInOnePass = true
