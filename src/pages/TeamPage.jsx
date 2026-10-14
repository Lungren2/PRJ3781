import { useCallback, useEffect, useState } from 'react'
import { PageIntro } from '../components/ProductUI.jsx'
import { useAuth } from '../components/AuthContext.jsx'

const ROLES = ['owner', 'recruiter', 'viewer']
export default function TeamPage() {
  const { user, activeOrganization: company, apiFetch, refreshAuth, mailTransport } = useAuth()
  const [team, setTeam] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const owner = company.role === 'owner'
  const base = `/api/organizations/${company.id}`
  const load = useCallback(async () => {
    setTeam(await apiFetch(`${base}/team`))
  }, [apiFetch, base])
  useEffect(() => {
    let active = true
    apiFetch(`${base}/team`)
      .then((data) => {
        if (active) setTeam(data)
      })
      .catch((error) => {
        if (active) setMessage(error.message)
      })
    return () => {
      active = false
    }
  }, [apiFetch, base])
  async function run(action, success) {
    setBusy(true)
    setMessage('')
    try {
      await action()
      const updated = await refreshAuth()
      if (updated?.organizations.some(({ id }) => id === company.id)) await load()
      setMessage(success)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main id="main-content" className="product-page">
      <PageIntro
        eyebrow="Your company"
        title={`${company.name} team`}
        copy="Owners manage the team. Recruiters manage postings. Viewers have read-only access."
      />
      <div className="page-container team-layout">
        <section className="form-surface">
          <h2>Team members</h2>
          {!team && !message && <p>Loading team...</p>}
          {team?.members.map((member) => (
            <article className="team-row" key={member.id}>
              <div>
                <strong>
                  {member.name}
                  {member.id === user.id ? ' (you)' : ''}
                </strong>
                <p>{member.email}</p>
              </div>
              {owner ? (
                <>
                  <label className="form-field">
                    <span>Role for {member.name}</span>
                    <select
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        run(
                          () =>
                            apiFetch(`${base}/members/${member.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role: event.target.value }),
                            }),
                          'Role updated.',
                        )
                      }
                    >
                      {ROLES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-action"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove ${member.name} from this company?`))
                        run(
                          () => apiFetch(`${base}/members/${member.id}`, { method: 'DELETE' }),
                          'Team member removed.',
                        )
                    }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span>{member.role}</span>
              )}
            </article>
          ))}
        </section>
        {owner && (
          <section className="form-surface">
            <h2>Invite a teammate</h2>
            {mailTransport === 'console' && (
              <p>Local development: invite links are printed in the API terminal.</p>
            )}
            <form
              className="account-form"
              onSubmit={(event) => {
                event.preventDefault()
                run(
                  async () => {
                    await apiFetch(`${base}/invitations`, {
                      method: 'POST',
                      body: JSON.stringify({ email, role }),
                    })
                    setEmail('')
                  },
                  mailTransport === 'console'
                    ? 'Invitation link printed in the API terminal.'
                    : 'Invitation sent.',
                )
              }}
            >
              <label className="form-field">
                <span>Email address</span>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Team role</span>
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button--dark" disabled={busy}>
                Send invitation
              </button>
            </form>
            {team?.invitations.length > 0 && <h3>Pending invitations</h3>}
            {team?.invitations.map((invite) => (
              <article className="team-row" key={invite.id}>
                <div>
                  <strong>{invite.email}</strong>
                  <p>
                    {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="text-action"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => apiFetch(`${base}/invitations/${invite.id}`, { method: 'DELETE' }),
                      'Invitation cancelled.',
                    )
                  }
                >
                  Cancel
                </button>
              </article>
            ))}
          </section>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </main>
  )
}
