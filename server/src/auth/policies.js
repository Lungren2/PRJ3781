export const EMPLOYER_ROLES = Object.freeze(['owner', 'recruiter', 'viewer'])

const EDITOR_ROLES = new Set(['owner', 'recruiter'])

export function membershipFor(user, organizationId) {
  if (!organizationId) return null
  return user?.organizations?.find((organization) => organization.id === organizationId) ?? null
}

export function canReadResume(user, resume) {
  return Boolean(user?.isCandidate && resume?.userId === user.id)
}

export function canBrowseCandidates(user, organizationId) {
  return EMPLOYER_ROLES.includes(membershipFor(user, organizationId)?.role)
}

export function canManageOrganization(user, organization) {
  const organizationId = typeof organization === 'string' ? organization : organization?.id
  return membershipFor(user, organizationId)?.role === 'owner'
}

export function canManageMembers(user, organization) {
  return canManageOrganization(user, organization)
}

export function canManageJobs(user, organizationId) {
  return EDITOR_ROLES.has(membershipFor(user, organizationId)?.role)
}

export function canReadJobDraft(user, job) {
  return EMPLOYER_ROLES.includes(membershipFor(user, job?.organizationId)?.role)
}

export function canEditJobDraft(user, job) {
  return canManageJobs(user, job?.organizationId)
}

export function canManageProductRequest(user, request) {
  return canManageJobs(user, request?.organizationId)
}

export function canViewApplicants(user, request) {
  return canManageProductRequest(user, request)
}

export function canApplyToProject(user, request) {
  if (!user?.isCandidate || !request?.id || request.status !== 'Open') return false
  if (!request.deadline) return true
  return String(request.deadline).slice(0, 10) >= new Date().toISOString().slice(0, 10)
}
