export const EMPLOYER_ROLES = ['owner', 'recruiter', 'viewer']

export function membershipFor(user, organizationId) {
  return user?.organizations?.find((organization) => organization.id === organizationId) ?? null
}

export function canReadResume(user, resume) {
  return Boolean(user?.isCandidate && resume?.user && String(resume.user) === user.id)
}

export function canEditJob(user, job) {
  return ['owner', 'recruiter'].includes(membershipFor(user, job?.organizationId)?.role)
}

// Owners and recruiters of the posting organization may edit, close or delete a
// product request; any member may see who applied.
export function canManageProductRequest(user, organizationId) {
  return ['owner', 'recruiter'].includes(membershipFor(user, organizationId)?.role)
}

export function canViewProductApplicants(user, organizationId) {
  return EMPLOYER_ROLES.includes(membershipFor(user, organizationId)?.role)
}

export function canBrowseCandidates(user, organizationId) {
  const membership = membershipFor(user, organizationId)
  return EMPLOYER_ROLES.includes(membership?.role) && membership.canBrowseCandidates === true
}

export function canManageOrganization(user, organizationId) {
  return membershipFor(user, organizationId)?.role === 'owner'
}
