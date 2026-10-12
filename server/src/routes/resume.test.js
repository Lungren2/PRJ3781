import assert from 'node:assert/strict'
import test from 'node:test'
import { detectFileType, validateProfile } from './resume.js'

test('validateProfile keeps known fields and rejects bad values', () => {
  assert.deepEqual(
    validateProfile({ institution: '  Belgium Campus ', workSetup: 'Remote', studyLevel: '', extra: 'x' }),
    { profile: { institution: 'Belgium Campus', workSetup: 'Remote' } },
  )
  assert.ok(validateProfile(null).error)
  assert.ok(validateProfile([]).error)
  assert.ok(validateProfile({ workSetup: 'On the moon' }).error)
  assert.ok(validateProfile({ institution: 42 }).error)
  assert.ok(validateProfile({ roles: 'a'.repeat(301) }).error)
})

test('detectFileType checks file contents against the extension', () => {
  const pdf = Buffer.from('%PDF-1.7\n')
  const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
  const doc = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  assert.equal(detectFileType(pdf, 'cv.PDF'), 'application/pdf')
  assert.equal(
    detectFileType(docx, 'cv.docx'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.equal(detectFileType(doc, 'cv.doc'), 'application/msword')
  assert.equal(detectFileType(pdf, 'cv.docx'), null)
  assert.equal(detectFileType(Buffer.from('<html>'), 'cv.pdf'), null)
  assert.equal(detectFileType(pdf, 'cv.exe'), null)
})
