import { useAuth } from './AuthContext.jsx'

export default function CompanySelector() {
  const { user, activeOrganization, selectOrganization } = useAuth()
  if (!activeOrganization) return null
  if (user.organizations.length === 1)
    return (
      <span>
        {activeOrganization.name} · {activeOrganization.role}
      </span>
    )
  return (
    <label className="company-selector">
      <span>Company</span>
      <select
        value={activeOrganization.id}
        onChange={(event) => selectOrganization(event.target.value)}
      >
        {user.organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name} · {organization.role}
          </option>
        ))}
      </select>
    </label>
  )
}
