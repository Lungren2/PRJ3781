import { getDb, nowIso } from './index.js'
import { SKILLS, TYPES, LEVELS, isSkillId, isTypeId, isLevelId } from '../normalize/taxonomy.js'

const upsertStatement = () =>
  getDb().prepare(`
  INSERT INTO certifications (
    provider, external_id, url, title, description, provider_name,
    type, level, duration, format, image_url, raw,
    first_seen_at, last_seen_at, delisted_at
  ) VALUES (
    @provider, @external_id, @url, @title, @description, @provider_name,
    @type, @level, @duration, @format, @image_url, @raw,
    @seen_at, @seen_at, NULL
  )
  ON CONFLICT (provider, external_id) DO UPDATE SET
    url = @url, title = @title, description = @description, provider_name = @provider_name,
    type = @type, level = @level, duration = @duration, format = @format,
    image_url = @image_url, raw = @raw, last_seen_at = @seen_at, delisted_at = NULL
`)

/** Insert or refresh one normalized record together with its skills. */
export function upsertCertification(record, seenAt = nowIso()) {
  const db = getDb()
  const run = db.transaction((entry) => {
    upsertStatement().run({
      provider: entry.provider,
      external_id: entry.externalId,
      url: entry.url,
      title: entry.title,
      description: entry.description ?? null,
      provider_name: entry.providerName,
      type: entry.type,
      level: entry.level,
      duration: entry.duration ?? null,
      format: entry.format ?? null,
      image_url: entry.imageUrl ?? null,
      raw: entry.raw ? JSON.stringify(entry.raw) : null,
      seen_at: seenAt,
    })

    const row = db
      .prepare('SELECT id FROM certifications WHERE provider = ? AND external_id = ?')
      .get(entry.provider, entry.externalId)

    db.prepare('DELETE FROM certification_skills WHERE certification_id = ?').run(row.id)
    const insertSkill = db.prepare(
      'INSERT OR IGNORE INTO certification_skills (certification_id, skill) VALUES (?, ?)',
    )
    for (const skill of entry.skills ?? []) insertSkill.run(row.id, skill)

    return row.id
  })

  return run(record)
}

/**
 * Mark records this provider stopped returning as delisted. Only safe after a run
 * that completed a full pass — a run truncated by a budget simply never reached the
 * tail of the catalogue, and delisting on that basis would erase live records.
 */
export function markDelisted(provider, runStartedAt) {
  return getDb()
    .prepare(`
    UPDATE certifications SET delisted_at = ?
    WHERE provider = ? AND delisted_at IS NULL AND last_seen_at < ?
  `)
    .run(nowIso(), provider, runStartedAt).changes
}

function buildFilter({ skill, type, level, q }) {
  const where = ['c.delisted_at IS NULL']
  const params = {}

  if (isTypeId(type)) {
    where.push('c.type = @type')
    params.type = type
  }
  if (isLevelId(level)) {
    where.push('c.level = @level')
    params.level = level
  }
  if (isSkillId(skill)) {
    where.push(
      'EXISTS (SELECT 1 FROM certification_skills s WHERE s.certification_id = c.id AND s.skill = @skill)',
    )
    params.skill = skill
  }
  if (q && q.trim()) {
    where.push('(c.title LIKE @q OR c.description LIKE @q OR c.provider_name LIKE @q)')
    params.q = `%${q.trim()}%`
  }

  return { clause: where.join(' AND '), params }
}

const withSkills = (rows) => {
  if (rows.length === 0) return []
  const db = getDb()
  const placeholders = rows.map(() => '?').join(',')
  const skillRows = db
    .prepare(
      `SELECT certification_id, skill FROM certification_skills WHERE certification_id IN (${placeholders})`,
    )
    .all(...rows.map((row) => row.id))

  const grouped = new Map()
  for (const { certification_id: id, skill } of skillRows) {
    if (!grouped.has(id)) grouped.set(id, [])
    grouped.get(id).push(skill)
  }

  return rows.map((row) => ({
    id: `${row.provider}:${row.external_id}`,
    title: row.title,
    description: row.description,
    url: row.url,
    provider: row.provider,
    providerName: row.provider_name,
    type: row.type,
    level: row.level,
    duration: row.duration,
    format: row.format,
    imageUrl: row.image_url,
    skills: grouped.get(row.id) ?? [],
    updatedAt: row.last_seen_at,
  }))
}

export function queryCertifications({ skill, type, level, q, page = 1, pageSize = 24 } = {}) {
  const db = getDb()
  const { clause, params } = buildFilter({ skill, type, level, q })
  const safePageSize = Math.min(Math.max(Number(pageSize) || 24, 1), 100)
  const safePage = Math.max(Number(page) || 1, 1)

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM certifications c WHERE ${clause}`)
    .get(params)

  const rows = db
    .prepare(`
    SELECT c.* FROM certifications c
    WHERE ${clause}
    ORDER BY
      CASE c.type WHEN 'certification' THEN 0 WHEN 'professional-certificate' THEN 1 ELSE 2 END,
      CASE c.level WHEN 'unspecified' THEN 1 ELSE 0 END,
      c.title COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize })

  return { items: withSkills(rows), total, page: safePage, pageSize: safePageSize }
}

/** The three vocabularies with live counts, so the UI only offers options that return results. */
export function getFacets(filters = {}) {
  const db = getDb()

  const countFor = (overrides) => {
    const { clause, params } = buildFilter({ ...filters, ...overrides })
    return db.prepare(`SELECT COUNT(*) AS total FROM certifications c WHERE ${clause}`).get(params)
      .total
  }

  return {
    skills: SKILLS.map(({ id, label }) => ({ id, label, count: countFor({ skill: id }) })),
    types: TYPES.map(({ id, label }) => ({ id, label, count: countFor({ type: id }) })),
    levels: LEVELS.map(({ id, label }) => ({ id, label, count: countFor({ level: id }) })),
    total: countFor({}),
  }
}

export function startRun(provider) {
  const startedAt = nowIso()
  const info = getDb()
    .prepare("INSERT INTO crawl_runs (provider, started_at, status) VALUES (?, ?, 'running')")
    .run(provider, startedAt)
  return { id: info.lastInsertRowid, startedAt }
}

export function finishRun(
  runId,
  { status, stats = {}, counts = {}, completePass = false, error = null },
) {
  getDb()
    .prepare(`
    UPDATE crawl_runs SET
      finished_at = @finished_at, status = @status,
      requests_made = @requests, cache_hits = @cache_hits, not_modified = @not_modified,
      records_seen = @seen, records_upserted = @upserted, records_skipped = @skipped,
      complete_pass = @complete_pass, error = @error
    WHERE id = @id
  `)
    .run({
      id: runId,
      finished_at: nowIso(),
      status,
      requests: stats.requests ?? 0,
      cache_hits: stats.cacheHits ?? 0,
      not_modified: stats.notModified ?? 0,
      seen: counts.seen ?? 0,
      upserted: counts.upserted ?? 0,
      skipped: counts.skipped ?? 0,
      complete_pass: completePass ? 1 : 0,
      error: error ? String(error).slice(0, 1000) : null,
    })
}

export function isRunInProgress() {
  return (
    getDb().prepare("SELECT COUNT(*) AS n FROM crawl_runs WHERE status = 'running'").get().n > 0
  )
}

export function getCursor(provider) {
  return (
    getDb().prepare('SELECT cursor FROM provider_state WHERE provider = ?').get(provider)?.cursor ??
    null
  )
}

export function setCursor(provider, cursor) {
  getDb()
    .prepare(`
    INSERT INTO provider_state (provider, cursor, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (provider) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at
  `)
    .run(provider, cursor, nowIso())
}

export function getHealth() {
  const db = getDb()
  return {
    providers: db
      .prepare(`
      SELECT provider,
             MAX(CASE WHEN status = 'ok' THEN finished_at END) AS last_success_at,
             MAX(finished_at) AS last_run_at
      FROM crawl_runs GROUP BY provider
    `)
      .all()
      .map((row) => ({
        provider: row.provider,
        lastSuccessAt: row.last_success_at,
        lastRunAt: row.last_run_at,
        records: db
          .prepare(
            'SELECT COUNT(*) AS n FROM certifications WHERE provider = ? AND delisted_at IS NULL',
          )
          .get(row.provider).n,
      })),
    records: db.prepare('SELECT COUNT(*) AS n FROM certifications WHERE delisted_at IS NULL').get()
      .n,
    lastSuccessAt: db
      .prepare("SELECT MAX(finished_at) AS at FROM crawl_runs WHERE status = 'ok'")
      .get().at,
  }
}
