import test from 'node:test'
import assert from 'node:assert/strict'
import { classifySkills, normalizeLevel, stripHtml, truncate } from './taxonomy.js'

test('provider tags dominate classification', () => {
  const skills = classifySkills({
    title: 'Some course',
    tags: ['machine-learning'],
  })
  assert.equal(skills[0], 'ai-machine-learning')
})

test('title keywords outrank description keywords', () => {
  const skills = classifySkills({
    title: 'Introduction to Cybersecurity',
    description: 'Also touches on project management topics.',
  })
  assert.equal(skills[0], 'cybersecurity')
})

test('non-technical records classify to nothing', () => {
  assert.deepEqual(
    classifySkills({ title: 'Ancient Greek Poetry', description: 'A survey of verse.' }),
    [],
  )
})

test('classification is capped at three skills', () => {
  const skills = classifySkills({
    title: 'AWS Azure Kubernetes SQL Machine Learning Cybersecurity Networking Bootcamp',
    description: 'Covers python, tableau, figma, agile, help desk and tcp/ip.',
    tags: ['cloud-computing', 'security', 'networking', 'machine-learning', 'data-analysis'],
  })
  assert.ok(skills.length <= 3, `expected at most 3 skills, got ${skills.length}`)
})

test('classification is deterministic', () => {
  const input = { title: 'Azure Fundamentals', tags: ['cloud-computing', 'administrator'] }
  assert.deepEqual(classifySkills(input), classifySkills(input))
})

test('normalizeLevel passes through known ids and maps synonyms', () => {
  assert.equal(normalizeLevel('beginner'), 'beginner')
  assert.equal(normalizeLevel('Advanced'), 'advanced')
  assert.equal(normalizeLevel('novice'), 'beginner')
})

test('normalizeLevel infers from text when the provider states nothing', () => {
  assert.equal(normalizeLevel(null, { title: 'Introduction to Python' }), 'beginner')
  assert.equal(normalizeLevel(null, { title: 'AWS Cloud Practitioner Essentials' }), 'foundation')
  assert.equal(normalizeLevel(null, { title: 'Kubernetes' }), 'unspecified')
})

test('advanced wins over beginner when both appear', () => {
  assert.equal(
    normalizeLevel(null, { title: 'Advanced SQL', description: 'basics recap' }),
    'advanced',
  )
})

test('stripHtml removes markup and decodes entities', () => {
  assert.equal(stripHtml('<p>Azure &amp; cloud</p>'), 'Azure & cloud')
})

test('truncate respects the limit', () => {
  assert.equal(truncate('abcdef', 4), 'abc…')
  assert.equal(truncate('abc', 10), 'abc')
})
