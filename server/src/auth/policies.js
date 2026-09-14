export const EMPLOYER_ROLES = ['owner', 'recruiter', 'viewer']

export function membershipFor(user, organizationId) {
  return user?.organizations?.find((organization) => organization.id === organizationId) ?? null
}

export function canReadResume(user, resume) {
  return Boolean(user?.isCandidate && resume?.userId === user.id)
}

export function canEditJob(user, job) {
  return ['owner', 'recruiter'].includes(membershipFor(user, job?.organizationId)?.role)
}

export function canBrowseCandidates(user, organizationId) {
  return EMPLOYER_ROLES.includes(membershipFor(user, organizationId)?.role)
}

export function canManageOrganization(user, organizationId) {
  return membershipFor(user, organizationId)?.role === 'owner'
}
