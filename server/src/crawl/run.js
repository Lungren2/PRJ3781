import {
  createCrawlContext,
  BudgetExceededError,
  RobotsDisallowedError,
  HostCooledOffError,
  OfflineCacheMissError,
} from '../http/fetcher.js'
import { enabledProviders, getProvider } from '../providers/index.js'
import { upsertCertification, markDelisted, startRun, finishRun } from '../db/repository.js'
import { nowIso } from '../db/index.js'

const EXPECTED = [
  BudgetExceededError,
  RobotsDisallowedError,
  HostCooledOffError,
  OfflineCacheMissError,
]
const isExpected = (error) => EXPECTED.some((type) => error instanceof type)

export async function crawlProvider(
  provider,
  { offline = false, dryRun = false, maxPages, verbose = true } = {},
) {
  const ctx = createCrawlContext({ offline, verbose })
  const { id: runId, startedAt } = startRun(provider.id)
  const counts = { seen: 0, upserted: 0, skipped: 0 }
  let completePass = provider.completesInOnePass === true
  let status = 'ok'
  let failure = null

  console.log(
    `[crawl] ${provider.id}: starting${offline ? ' (offline)' : ''}${dryRun ? ' (dry run)' : ''}`,
  )

  try {
    const iterator = provider.crawl(ctx, { maxPages })
    let result = await iterator.next()

    while (!result.done) {
      const record = result.value
      counts.seen += 1
      if (dryRun) {
        counts.skipped += 1
      } else {
        upsertCertification(record, startedAt)
        counts.upserted += 1
      }
      result = await iterator.next()
    }

    if (result.value && typeof result.value === 'object' && 'completePass' in result.value) {
      completePass = result.value.completePass
    }
  } catch (error) {
    failure = error
    status = isExpected(error) ? 'truncated' : 'error'
    completePass = false
    const level = status === 'truncated' ? console.warn : console.error
    level(`[crawl] ${provider.id}: ${error.name}: ${error.message}`)
  }

  // Delisting is only sound after a full pass; a truncated run simply never reached
  // the rest of the catalogue.
  let delisted = 0
  if (!dryRun && completePass && status === 'ok') {
    delisted = markDelisted(provider.id, startedAt)
  }

  finishRun(runId, {
    status,
    stats: ctx.stats,
    counts,
    completePass,
    error: failure?.message ?? null,
  })

  const summary = {
    provider: provider.id,
    status,
    completePass,
    delisted,
    ...counts,
    ...ctx.stats,
    finishedAt: nowIso(),
  }
  console.log(`[crawl] ${provider.id}: ${status} — ${JSON.stringify(summary)}`)
  return summary
}

export async function crawlAll({ providerId, ...options } = {}) {
  const targets = providerId ? [getProvider(providerId)].filter(Boolean) : enabledProviders()

  if (providerId && targets.length === 0) {
    throw new Error(`unknown provider: ${providerId}`)
  }

  const summaries = []
  for (const provider of targets) {
    if (!provider.enabled()) {
      console.log(`[crawl] ${provider.id}: disabled by configuration, skipping`)
      continue
    }
    summaries.push(await crawlProvider(provider, options))
  }
  return summaries
}
