import { config } from '../config.js'
import { getRobots } from './robots.js'
import { readCache, writeCache, touchCache } from './cache.js'
import { HostLimiter, sleep, backoffDelay } from './limiter.js'

export class RobotsDisallowedError extends Error {
  constructor(url, reason) {
    super(`robots.txt disallows ${url} (${reason})`)
    this.name = 'RobotsDisallowedError'
    this.url = url
  }
}

export class BudgetExceededError extends Error {
  constructor(budget) {
    super(`crawl budget exceeded: ${budget}`)
    this.name = 'BudgetExceededError'
    this.budget = budget
  }
}

export class HostCooledOffError extends Error {
  constructor(host) {
    super(`host ${host} cooled off after repeated failures`)
    this.name = 'HostCooledOffError'
    this.host = host
  }
}

export class OfflineCacheMissError extends Error {
  constructor(url) {
    super(`offline mode and no cached copy of ${url}`)
    this.name = 'OfflineCacheMissError'
    this.url = url
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * One crawl run's worth of shared state: rate limiter, budget counters, per-host
 * failure tracking. Everything that reaches the network goes through `fetchText`.
 */
export function createCrawlContext({ offline = false, verbose = true } = {}) {
  const limiter = new HostLimiter({
    minIntervalMs: config.crawl.minRequestIntervalMs,
    maxConcurrent: config.crawl.maxConcurrentPerHost,
  })

  const stats = { requests: 0, cacheHits: 0, notModified: 0, retries: 0, robotsBlocked: 0 }
  const failures = new Map()
  const cooled = new Set()
  const robotsChecked = new Set()
  const startedAt = Date.now()

  const log = (...args) => {
    if (verbose) console.log(...args)
  }

  function assertBudget() {
    if (stats.requests >= config.crawl.maxRequestsPerRun) {
      throw new BudgetExceededError(`maxRequestsPerRun=${config.crawl.maxRequestsPerRun}`)
    }
    const elapsedMinutes = (Date.now() - startedAt) / 60000
    if (elapsedMinutes >= config.crawl.maxRunMinutes) {
      throw new BudgetExceededError(`maxRunMinutes=${config.crawl.maxRunMinutes}`)
    }
  }

  function noteFailure(host) {
    const count = (failures.get(host) ?? 0) + 1
    failures.set(host, count)
    if (count >= config.crawl.hostFailureLimit) {
      cooled.add(host)
      console.warn(
        `[crawl] cooling off ${host} for the rest of this run after ${count} consecutive failures`,
      )
    }
  }

  /**
   * @param {string} url
   * @param {object} options
   * @param {boolean} options.skipRobots  Documented per-provider exception (see config.js).
   * @param {boolean} options.allowStale  Serve a fresh-enough cached copy without any request.
   */
  async function fetchText(url, { skipRobots = false, allowStale = true, headers = {} } = {}) {
    const host = new URL(url).host

    // 1. A cached copy that is still fresh costs zero requests.
    const cached = readCache(url)
    if (allowStale && cached?.isFresh) {
      stats.cacheHits += 1
      log(`[crawl] cache-fresh ${url}`)
      return { body: cached.readBody(), status: cached.status, fromCache: true }
    }

    if (offline) {
      if (cached) {
        stats.cacheHits += 1
        log(`[crawl] cache-offline ${url}`)
        return { body: cached.readBody(), status: cached.status, fromCache: true }
      }
      throw new OfflineCacheMissError(url)
    }

    if (cooled.has(host)) throw new HostCooledOffError(host)

    // 2. Robots gate. Every URL, before any request is issued.
    if (!skipRobots) {
      const robots = await getRobots(host)
      if (!robots.isAllowed(url)) {
        stats.robotsBlocked += 1
        throw new RobotsDisallowedError(url, robots.reason)
      }
      if (!robotsChecked.has(host)) {
        robotsChecked.add(host)
        const delay = robots.crawlDelayMs()
        if (delay > 0) {
          limiter.setHostInterval(host, delay)
          log(`[crawl] honouring Crawl-delay ${delay}ms for ${host}`)
        }
      }
    } else {
      log(`[crawl] robots gate skipped for ${url} (documented provider exception)`)
    }

    // 3. Rate-limited, conditional request with bounded retries.
    for (let attempt = 0; attempt <= config.crawl.maxRetries; attempt += 1) {
      assertBudget()
      const release = await limiter.acquire(host)

      try {
        const requestHeaders = {
          'user-agent': config.userAgent,
          accept: 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br',
          ...headers,
        }
        if (cached?.etag) requestHeaders['if-none-match'] = cached.etag
        if (cached?.last_modified) requestHeaders['if-modified-since'] = cached.last_modified

        stats.requests += 1
        const response = await fetch(url, {
          headers: requestHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        })

        if (response.status === 304 && cached) {
          stats.notModified += 1
          failures.delete(host)
          touchCache(url, response.headers)
          log(`[crawl] 304 ${url}`)
          return { body: cached.readBody(), status: 304, fromCache: true }
        }

        if (RETRYABLE.has(response.status)) {
          const retryAfter = Number(response.headers.get('retry-after'))
          const wait =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : backoffDelay(attempt)
          noteFailure(host)
          console.warn(
            `[crawl] ${response.status} on ${url}; backing off ${wait}ms (attempt ${attempt + 1})`,
          )
          release()
          stats.retries += 1
          await sleep(wait)
          if (cooled.has(host)) throw new HostCooledOffError(host)
          continue
        }

        if (!response.ok) {
          noteFailure(host)
          throw new Error(`HTTP ${response.status} for ${url}`)
        }

        const body = await response.text()
        failures.delete(host)
        writeCache(url, { status: response.status, headers: response.headers, body })
        log(`[crawl] 200 ${url} (${body.length} bytes)`)
        return { body, status: response.status, fromCache: false }
      } catch (error) {
        if (error instanceof BudgetExceededError || error instanceof HostCooledOffError) throw error
        if (attempt >= config.crawl.maxRetries) {
          noteFailure(host)
          throw error
        }
        stats.retries += 1
        const wait = backoffDelay(attempt)
        console.warn(`[crawl] ${error.message}; retrying in ${wait}ms`)
        await sleep(wait)
      } finally {
        release()
      }
    }

    throw new Error(`exhausted retries for ${url}`)
  }

  async function fetchJson(url, options) {
    const { body, ...rest } = await fetchText(url, options)
    return { data: JSON.parse(body), ...rest }
  }

  return { fetchText, fetchJson, stats, assertBudget, offline, startedAt }
}
