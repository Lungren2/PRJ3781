import robotsParser from 'robots-parser'
import { config } from '../config.js'
import { getDb, nowIso } from '../db/index.js'

const parsed = new Map()

function cacheIsFresh(fetchedAt) {
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age < config.crawl.robotsTtlMinutes * 60 * 1000
}

async function loadRobots(host) {
  const db = getDb()
  const row = db
    .prepare('SELECT body, status, fetched_at FROM robots_cache WHERE host = ?')
    .get(host)
  if (row && cacheIsFresh(row.fetched_at)) return row

  const url = `https://${host}/robots.txt`
  let body = null
  let status = 0

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': config.userAgent, accept: 'text/plain' },
      signal: AbortSignal.timeout(15000),
    })
    status = response.status
    body = response.ok ? await response.text() : null
  } catch (error) {
    // Network failure reaching robots.txt. Treat as unknown rather than permission.
    status = 0
    body = null
    console.warn(`[robots] could not fetch ${url}: ${error.message}`)
  }

  const record = { body, status, fetched_at: nowIso() }
  db.prepare(`
    INSERT INTO robots_cache (host, body, status, fetched_at)
    VALUES (@host, @body, @status, @fetched_at)
    ON CONFLICT (host) DO UPDATE SET body = @body, status = @status, fetched_at = @fetched_at
  `).run({ host, ...record })

  parsed.delete(host)
  return record
}

/**
 * Resolve the robots policy for a host.
 *
 * Conventional handling of the awkward statuses:
 *   4xx  -> no robots file published, everything is allowed
 *   5xx  -> the site is unwell; refuse to crawl rather than guess
 *   0    -> we could not reach it at all; refuse, same reasoning
 */
export async function getRobots(host) {
  const record = await loadRobots(host)

  if (!parsed.has(host)) {
    const robots = record.body ? robotsParser(`https://${host}/robots.txt`, record.body) : null
    parsed.set(host, robots)
  }

  const robots = parsed.get(host)
  const unavailableButAllowed = record.status >= 400 && record.status < 500

  return {
    status: record.status,
    isAllowed(url) {
      if (robots) return robots.isAllowed(url, config.robotsAgent) !== false
      return unavailableButAllowed
    },
    crawlDelayMs() {
      const delay = robots?.getCrawlDelay(config.robotsAgent)
      return Number.isFinite(delay) ? delay * 1000 : 0
    },
    reason: robots ? 'robots.txt' : `robots.txt unavailable (status ${record.status})`,
  }
}

export function clearRobotsMemo() {
  parsed.clear()
}
