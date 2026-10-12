import express from 'express'
import { requireCandidate, requireCsrf } from '../auth/middleware.js'
import { canReadResume } from '../auth/policies.js'
import {
  deleteResumeFile,
  getResumeForUser,
  isResumeStoreReady,
  openResumeFileStream,
  saveResumeFile,
  saveResumeProfile,
} from '../db/resumeRepository.js'

export const MAX_RESUME_BYTES = 10 * 1024 * 1024

const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const PROFILE_FIELDS = {
  studyLevel: { options: ['Undergraduate', 'Postgraduate', 'Recent graduate'] },
  institution: { maxLength: 120 },
  fieldOfStudy: { maxLength: 120 },
  graduationYear: { options: ['2026', '2027', '2028', 'Already graduated'] },
  roles: { maxLength: 300 },
  workSetup: { options: ['Flexible', 'On-site', 'Hybrid', 'Remote'] },
}

export const resumeRouter = express.Router()

function requireResumeStore(req, res, next) {
  if (!isResumeStoreReady()) return res.status(503).json({ error: 'resume storage is unavailable' })
  next()
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'profile must be an object' }
  }
  const profile = {}
  for (const [key, rule] of Object.entries(PROFILE_FIELDS)) {
    const value = input[key]
    if (value === undefined || value === null || value === '') continue
    if (typeof value !== 'string') return { error: `${key} must be text` }
    const trimmed = value.trim()
    if (rule.options && !rule.options.includes(trimmed)) return { error: `${key} is not a valid option` }
    if (rule.maxLength && trimmed.length > rule.maxLength) {
      return { error: `${key} must be at most ${rule.maxLength} characters` }
    }
    if (trimmed) profile[key] = trimmed
  }
  return { profile }
}

// Trust the file's leading bytes, not the name or header the browser sent.
export function detectFileType(buffer, fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const bytes = buffer.subarray(0, 8)
  if (extension === 'pdf' && bytes.toString('latin1', 0, 5) === '%PDF-') return FILE_TYPES.pdf
  if (extension === 'docx' && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return FILE_TYPES.docx
  }
  if (extension === 'doc' && bytes.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
    return FILE_TYPES.doc
  }
  return null
}

function cleanFileName(raw) {
  let name = ''
  try {
    name = decodeURIComponent(raw ?? '')
  } catch {
    return ''
  }
  // Keep only the base name and drop control/path characters.
  return name.split(/[\\/]/).pop().replace(/[\u0000-\u001f"<>|:*?]/g, '').trim().slice(0, 150)
}

export function sendResumeFile(res, file, stream, next) {
  res.set({
    'content-type': file.contentType,
    'content-length': String(file.size),
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  })
  stream.once('error', next).pipe(res)
}

function toResponse(user, resume) {
  const file = resume?.file?.fileId
    ? {
        fileName: resume.file.fileName,
        contentType: resume.file.contentType,
        size: resume.file.size,
        uploadedAt: resume.file.uploadedAt,
      }
    : null
  return {
    userId: user.id,
    profile: resume?.profile ?? {},
    visibleToEmployers: resume?.visibleToEmployers ?? false,
    file,
    updatedAt: resume?.updatedAt ?? null,
  }
}

resumeRouter.get('/candidate/resume', requireCandidate, requireResumeStore, async (req, res, next) => {
  try {
    res.json(toResponse(req.user, await getResumeForUser(req.user.id)))
  } catch (error) {
    next(error)
  }
})

resumeRouter.put('/candidate/resume', requireCandidate, requireCsrf, requireResumeStore, async (req, res, next) => {
  const { profile, error } = validateProfile(req.body?.profile)
  if (error) return res.status(400).json({ error })
  const visibleToEmployers = req.body?.visibleToEmployers ?? false
  if (typeof visibleToEmployers !== 'boolean') {
    return res.status(400).json({ error: 'visibleToEmployers must be true or false' })
  }
  try {
    res.json(toResponse(req.user, await saveResumeProfile(req.user.id, { profile, visibleToEmployers })))
  } catch (err) {
    next(err)
  }
})

resumeRouter.put(
  '/candidate/resume/file',
  requireCandidate,
  requireCsrf,
  requireResumeStore,
  express.raw({ type: () => true, limit: MAX_RESUME_BYTES }),
  async (req, res, next) => {
    const fileName = cleanFileName(req.get('x-file-name'))
    if (!fileName) return res.status(400).json({ error: 'x-file-name header is required' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'resume file is empty' })
    }
    const contentType = detectFileType(req.body, fileName)
    if (!contentType) return res.status(415).json({ error: 'resume must be a PDF, DOC, or DOCX file' })
    try {
      const resume = await saveResumeFile(req.user.id, { buffer: req.body, fileName, contentType })
      res.status(201).json(toResponse(req.user, resume))
    } catch (error) {
      next(error)
    }
  },
)

resumeRouter.get('/candidate/resume/file', requireCandidate, requireResumeStore, async (req, res, next) => {
  try {
    const resume = await getResumeForUser(req.user.id)
    if (!resume?.file?.fileId) return res.status(404).json({ error: 'no resume file uploaded' })
    if (!canReadResume(req.user, resume)) return res.status(403).json({ error: 'resume access denied' })

    sendResumeFile(res, resume.file, openResumeFileStream(resume.file.fileId), next)
  } catch (error) {
    next(error)
  }
})

resumeRouter.delete('/candidate/resume/file', requireCandidate, requireCsrf, requireResumeStore, async (req, res, next) => {
  try {
    const removed = await deleteResumeFile(req.user.id)
    if (!removed) return res.status(404).json({ error: 'no resume file uploaded' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

resumeRouter.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'resume must be 10MB or smaller' })
  }
  next(error)
})
