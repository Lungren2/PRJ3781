import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveOrganization,
  savedOrganizationId,
  saveOrganizationId,
} from './organizationSelection.js'

const user = {
  id: 'person',
  organizations: [
    { id: 'a', name: 'First', role: 'owner' },
    { id: 'b', name: 'Second', role: 'viewer' },
  ],
}
test('selection uses the chosen membership and falls back after removal', () => {
  assert.equal(resolveOrganization(user, 'b').name, 'Second')
  assert.equal(resolveOrganization(user, 'unrelated').id, 'a')
  assert.equal(
    resolveOrganization({ ...user, organizations: [user.organizations[0]] }, 'b').id,
    'a',
  )
  assert.equal(resolveOrganization(null, 'b'), null)
  assert.equal(resolveOrganization({ organizations: [] }, 'b'), null)
})
test('saved company choices are separate for each account', (t) => {
  const values = new Map()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  })
  saveOrganizationId('one', 'a')
  saveOrganizationId('two', 'b')
  assert.equal(savedOrganizationId('one'), 'a')
  assert.equal(savedOrganizationId('two'), 'b')
})
