import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { getDb, nowIso } from '../db/index.js'

const hashUrl = (url) => crypto.createHash('sha256').update(url).digest('hex')

function bodyPathFor(urlHash) {
  return path.join(config.cacheDir, `${urlHash}.body`)
}

/** Parse `Cache-Control: max-age=N` into an absolute expiry, else fall back to our TTL. */
function freshUntilFrom(headers) {
  const cacheControl = headers.get('cache-control') ?? ''
  if (/no-store|no-cache/i.test(cacheControl)) return null

  const maxAge = /max-age=(\d+)/i.exec(cacheControl)
  const seconds = maxAge ? Number(maxAge[1]) : config.crawl.defaultCacheTtlMinutes * 60
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export function readCache(url) {
  const urlHash = hashUrl(url)
  const row = getDb().prepare('SELECT * FROM http_cache WHERE url_hash = ?').get(urlHash)
  if (!row) return null
  if (!fs.existsSync(row.body_path)) return null

  return {
    ...row,
    isFresh: Boolean(row.fresh_until) && new Date(row.fresh_until).getTime() > Date.now(),
    readBody: () => fs.readFileSync(row.body_path, 'utf8'),
  }
}

export function writeCache(url, { status, headers, body }) {
  const urlHash = hashUrl(url)
  const bodyPath = bodyPathFor(urlHash)

  fs.mkdirSync(config.cacheDir, { recursive: true })
  fs.writeFileSync(bodyPath, body)

  const record = {
    url_hash: urlHash,
    url,
    status,
    etag: headers.get('etag'),
    last_modified: headers.get('last-modified'),
    fetched_at: nowIso(),
    fresh_until: freshUntilFrom(headers),
    body_path: bodyPath,
    body_bytes: Buffer.byteLength(body),
  }

  getDb()
    .prepare(`
    INSERT INTO http_cache (url_hash, url, status, etag, last_modified, fetched_at, fresh_until, body_path, body_bytes)
    VALUES (@url_hash, @url, @status, @etag, @last_modified, @fetched_at, @fresh_until, @body_path, @body_bytes)
    ON CONFLICT (url_hash) DO UPDATE SET
      status = @status, etag = @etag, last_modified = @last_modified,
      fetched_at = @fetched_at, fresh_until = @fresh_until,
      body_path = @body_path, body_bytes = @body_bytes
  `)
    .run(record)

  return record
}

/** Refresh freshness after a 304, so a revalidated entry does not re-ask immediately. */
export function touchCache(url, headers) {
  getDb()
    .prepare('UPDATE http_cache SET fetched_at = ?, fresh_until = ? WHERE url_hash = ?')
    .run(nowIso(), freshUntilFrom(headers), hashUrl(url))
}

export function cacheStats() {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS entries, COALESCE(SUM(body_bytes), 0) AS bytes FROM http_cache')
    .get()
  return row
}
