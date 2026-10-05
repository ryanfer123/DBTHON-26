import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { loadCommunity } from '../../lib/community'
import type { Community, RoleId } from '../../lib/community'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: Community }

export function CommunityPanel() {
  const { role } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const buttons = useRef<Map<RoleId, HTMLButtonElement>>(new Map())

  useEffect(() => {
    const controller = new AbortController()
    loadCommunity(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ status: 'loaded', data })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' })
    })
    return () => controller.abort()
  }, [attempt])

  const selected = role === 'receiver' || role === 'volunteer' ? role : 'donor'

  return (
    <section className="community-section" id="community" aria-labelledby="community-heading">
      <div className="container">
        <h2 id="community-heading">A place for everyone to help.</h2>
        {state.status === 'loading' && <p role="status" className="community-message">Loading community details…</p>}
        {state.status === 'error' && <div role="alert" className="community-message">
          <p>Community details couldn’t load. Please try again.</p>
          <button className="button button-small" onClick={() => {
            setState({ status: 'loading' }); setAttempt(a => a + 1)
          }}>Try again</button>
        </div>}
        {state.status === 'loaded' && <>
          <div className="role-tabs" role="tablist" aria-label="Community roles">
            {state.data.roles.map((item, index) => <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected === item.id ? 0 : -1}
              ref={element => { if (element) buttons.current.set(item.id, element) }}
              onClick={() => navigate(`/community/${item.id}`, { preventScrollReset: true })}
              onKeyDown={event => {
                const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
                if (!keys.includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
                  : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3
                const id = state.data.roles[next].id
                navigate(`/community/${id}`, { preventScrollReset: true })
                buttons.current.get(id)?.focus()
              }}
            >{item.name}</button>)}
          </div>
          {state.data.roles.map(item => <div
            key={item.id} className="role-panel" id={`panel-${item.id}`} role="tabpanel"
            aria-labelledby={`tab-${item.id}`} hidden={selected !== item.id} tabIndex={0}
          ><p>{item.description}</p><Link className="text-link role-join" to={`/register?role=${item.id}`}>Join as a {item.id} <span aria-hidden="true">→</span></Link></div>)}
        </>}
      </div>
    </section>
  )
}
