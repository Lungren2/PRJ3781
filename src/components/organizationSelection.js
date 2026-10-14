export function resolveOrganization(user, selectedId) {
  return (
    user?.organizations?.find(({ id }) => id === selectedId) ?? user?.organizations?.[0] ?? null
  )
}

export function savedOrganizationId(userId) {
  try {
    return localStorage.getItem(`morrow:company:${userId}`)
  } catch {
    return null
  }
}

export function saveOrganizationId(userId, id) {
  try {
    localStorage.setItem(`morrow:company:${userId}`, id)
  } catch {
    /* Selection still works when browser storage is unavailable. */
  }
}
