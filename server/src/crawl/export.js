import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { queryCertifications, getFacets, getHealth } from '../db/repository.js'
import { nowIso } from '../db/index.js'

const SNAPSHOT_LIMIT = Number(process.env.MORROW_SNAPSHOT_LIMIT ?? 600)

/**
 * Write the fallback snapshot the frontend reads when the API is unreachable.
 * Deliberately a curated subset, not the whole table: this ships to the browser.
 */
export async function exportSnapshot(targetPath = config.snapshotPath) {
  const { items, total } = queryCertifications({ page: 1, pageSize: 100 })
  const collected = [...items]

  for (let page = 2; collected.length < SNAPSHOT_LIMIT; page += 1) {
    const next = queryCertifications({ page, pageSize: 100 })
    if (next.items.length === 0) break
    collected.push(...next.items)
  }

  const snapshot = {
    generatedAt: nowIso(),
    total,
    included: Math.min(collected.length, SNAPSHOT_LIMIT),
    facets: getFacets(),
    health: getHealth(),
    items: collected.slice(0, SNAPSHOT_LIMIT),
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`)

  const bytes = fs.statSync(targetPath).size
  console.log(
    `[export] wrote ${snapshot.included} of ${total} records to ${targetPath} (${(bytes / 1024).toFixed(0)} KB)`,
  )
  return snapshot
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { closeDb } = await import('../db/index.js')
  await exportSnapshot()
  closeDb()
}
