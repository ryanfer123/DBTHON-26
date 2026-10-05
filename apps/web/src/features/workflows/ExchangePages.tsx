import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../identity/AuthContext'
import { date, localInput, params, useCommand, useQuery, type Exchange, type Resource, type Rows, type Task } from './data'
import { Access, Coordinates, Countdown, Feedback, Pagination, QueryStatus, Workspace } from './Workspace'

function ExchangeActions({ exchange, refresh, admin = false }: { exchange: Exchange; refresh: () => void; admin?: boolean }) {
  const { session } = useAuth()
  const userId = session!.user.user_id
  const command = useCommand()
  const [reasonAction, setReasonAction] = useState('')
  const prefix = `/claims/${exchange.claim_id}`
  const pickup = `${prefix}/pickups/${exchange.pickup_id}`
  const volunteer = exchange.volunteer_id === userId && session!.user.capabilities.includes('Volunteer')
  const canRate = exchange.status === 'Completed' && exchange.my_rating === null &&
    (exchange.donor_id === userId || exchange.receiver_id === userId)
  async function change(path: string, body: unknown = {}) {
    if (await command.run(path, body)) { command.setNotice('Exchange updated.'); setReasonAction(''); refresh() }
  }
  return <div className="exchange-actions"><Feedback {...command} />
    <div className="actions">
      {exchange.status === 'Confirmed' && exchange.pickup_status !== 'PickedUp' && exchange.receiver_id === userId && <button className="text-button" disabled={command.busy} onClick={() => setReasonAction(reasonAction ? '' : `${prefix}/cancel`)}>Cancel claim</button>}
      {exchange.status === 'Confirmed' && volunteer && exchange.pickup_status === 'Scheduled' && <>
        <button className="button button-small" disabled={command.busy} onClick={() => void change(`${pickup}/picked-up`)}>Record pickup</button>
        <button className="text-button" disabled={command.busy} onClick={() => setReasonAction(reasonAction ? '' : `${pickup}/cancel`)}>Cancel assignment</button>
      </>}
      {exchange.status === 'Confirmed' && volunteer && exchange.pickup_status === 'PickedUp' && <button className="button button-small" disabled={command.busy} onClick={() => void change(`${pickup}/delivered`)}>Confirm delivery</button>}
      {admin && exchange.status === 'Confirmed' && <button className="text-button" disabled={command.busy} onClick={() => setReasonAction(reasonAction ? '' : `/admin/claims/${exchange.claim_id}/fail`)}>Record failed exchange</button>}
      {exchange.status === 'Confirmed' && exchange.donor_id === userId && <Link className="text-link" to={`/food/${exchange.listing_id}`}>Manage donation</Link>}
    </div>
    {reasonAction && <form className="reason-form" onSubmit={event => { event.preventDefault(); void change(reasonAction, { reason: String(new FormData(event.currentTarget).get('reason')).trim() }) }}>
      <fieldset disabled={command.busy} className="form-fields"><div className="field"><label htmlFor={`reason-${exchange.claim_id}-${exchange.pickup_id}`}>Reason for this action</label><textarea id={`reason-${exchange.claim_id}-${exchange.pickup_id}`} name="reason" required minLength={3} maxLength={300} rows={2} /></div><div className="actions"><button className="button button-small button-outline" type="submit">Confirm action</button><button className="text-button" type="button" onClick={() => setReasonAction('')}>Keep exchange</button></div></fieldset>
    </form>}
    {canRate && <form className="rating-form" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget)
      void change(`${prefix}/ratings`, { target_user_id: exchange.donor_id === userId ? exchange.receiver_id : exchange.donor_id, score: Number(form.get('score')), comments: String(form.get('comments')).trim() || null })
    }}><fieldset disabled={command.busy} className="form-fields"><h3>Rate your exchange with {exchange.donor_id === userId ? exchange.receiver_name : exchange.donor_name}</h3>
      <div className="field"><label htmlFor={`score-${exchange.claim_id}`}>Rating</label><select id={`score-${exchange.claim_id}`} name="score" required defaultValue=""><option value="" disabled>Choose a score</option>{[5, 4, 3, 2, 1].map(score => <option key={score} value={score}>{score} / 5</option>)}</select></div>
      <div className="field"><label htmlFor={`comments-${exchange.claim_id}`}>Comments (optional)</label><textarea id={`comments-${exchange.claim_id}`} name="comments" maxLength={300} rows={2} /></div>
      <button className="button button-small" type="submit">Submit rating</button></fieldset></form>}
    {exchange.my_rating !== null && <p className="field-help">Your rating: {exchange.my_rating} / 5</p>}
  </div>
}
function ExchangeDetails({ exchange, refresh, admin = false }: { exchange: Exchange; refresh: () => void; admin?: boolean }) {
  return <><dl className="detail-list">
    <dt>Donor</dt><dd>{exchange.donor_name}{exchange.donor_phone && <> · <a href={`tel:${exchange.donor_phone}`}>{exchange.donor_phone}</a></>}</dd>
    <dt>Receiver</dt><dd>{exchange.receiver_name}{exchange.receiver_phone && <> · <a href={`tel:${exchange.receiver_phone}`}>{exchange.receiver_phone}</a></>}</dd>
    <dt>Pickup point</dt><dd><Coordinates lat={exchange.pickup_lat} lon={exchange.pickup_long} /></dd>
    {exchange.receiver_latitude && exchange.receiver_longitude && <><dt>Delivery point</dt><dd><Coordinates lat={exchange.receiver_latitude} lon={exchange.receiver_longitude} /></dd></>}
    <dt>Collect / deliver by</dt><dd>{date(exchange.expiry_window_end)}</dd>
    <dt>Claimed</dt><dd>{date(exchange.claimed_at)}</dd>
    <dt>Volunteer</dt><dd>{exchange.volunteer_name ?? 'Awaiting volunteer assignment'}</dd>
    {exchange.pickup_id !== null && <><dt>Attempt</dt><dd>Claim {exchange.claim_id} · Pickup {exchange.pickup_id} · {exchange.pickup_status}</dd><dt>Scheduled collection</dt><dd>{date(exchange.scheduled_time)}</dd><dt>Picked up</dt><dd>{date(exchange.actual_pickup_time)}</dd><dt>Delivered</dt><dd>{date(exchange.delivery_time)}</dd></>}
    {exchange.ended_at && <><dt>Exchange ended</dt><dd>{date(exchange.ended_at)}</dd></>}
    {exchange.cancellation_reason && <><dt>Reason</dt><dd>{exchange.cancellation_reason}</dd></>}
  </dl><ExchangeActions exchange={exchange} refresh={refresh} admin={admin} /></>
}
export function ExchangesPage({ admin = false }: { admin?: boolean }) {
  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState<string | number | null>(null)
  const query = useQuery<Rows<Exchange>>(`${admin ? '/admin/claims' : '/claims/mine'}?${params({ status, cursor: cursor ?? 0 })}`)
  return <Access roles={admin ? ['Admin'] : ['Donor', 'Receiver']}><Workspace title={admin ? 'Review exchanges' : 'My exchanges'} intro={admin ? 'Review food movements and record failures in your zone.' : 'Follow your food from reservation to delivery.'}>
    <div className="workspace-toolbar"><div className="field"><label htmlFor="claim-filter">Claim status</label><select id="claim-filter" value={status} onChange={event => { setStatus(event.target.value); setCursor(null) }}><option value="">All exchanges</option>{['Confirmed', 'Completed', 'Cancelled', 'Expired'].map(status => <option key={status}>{status}</option>)}</select></div><button className="text-button" onClick={query.refresh} disabled={query.loading}>Refresh exchanges</button></div>
    <QueryStatus {...query} />{query.data && <><ul className="exchange-list">{query.data.data.map(exchange => <li className="exchange-row" key={exchange.claim_id}>
      <div><h2>{exchange.food_type}</h2><p>{exchange.quantity_kg} kg · {exchange.status}</p><p className="field-help">{exchange.donor_name} → {exchange.receiver_name}</p></div>
      <div><p>{exchange.pickup_status ?? 'Awaiting volunteer'}</p>{exchange.status === 'Confirmed' && <Countdown key={query.data!.meta.server_time} end={exchange.expiry_window_end} serverTime={query.data!.meta.server_time} />}</div>
      <Link className="button button-small button-outline" to={`/claims/${exchange.claim_id}`}>View exchange</Link>
    </li>)}</ul>{!query.data.data.length && <p className="list-message">No exchanges match this view.</p>}<Pagination meta={query.data.meta} cursor={cursor} setCursor={setCursor} /></>}
  </Workspace></Access>
}
export function ExchangeDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const query = useQuery<Resource<Exchange>>(`/claims/${id}`)
  return <Workspace title={query.data?.data.food_type ?? 'Exchange details'} intro={query.data ? `${query.data.data.quantity_kg} kg · ${query.data.data.status}` : 'Collection, delivery and participant details.'}>
    <QueryStatus {...query} />{query.data && <section className="exchange-detail"><ExchangeDetails exchange={query.data.data} refresh={query.refresh} admin={session!.user.capabilities.includes('Admin')} /><button className="text-button" onClick={query.refresh}>Refresh this exchange</button></section>}
  </Workspace>
}
function AcceptTask({ task, refresh }: { task: Task; refresh: () => void }) {
  const command = useCommand()
  const [open, setOpen] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const time = new Date(String(new FormData(event.currentTarget).get('scheduled'))).toISOString()
    if (await command.run(`/claims/${task.claim_id}/pickups`, { scheduled_time: time })) { setOpen(false); refresh() }
  }
  return <><button className="button button-outline button-small" onClick={() => setOpen(value => !value)}>{open ? 'Close scheduling' : 'Arrange collection'}</button>
    {open && <form className="schedule-form" onSubmit={submit}><fieldset disabled={command.busy} className="form-fields"><div className="field"><label htmlFor={`scheduled-${task.claim_id}`}>Collection time</label><input id={`scheduled-${task.claim_id}`} name="scheduled" type="datetime-local" required min={localInput()} max={localInput(new Date(task.expiry_window_end))} /></div><p className="field-help">Choose a future time before the donor’s deadline. Assignment is confirmed when you save.</p><Feedback {...command} /><button className="button button-small" type="submit">{command.busy ? 'Assigning…' : 'Accept delivery'}</button></fieldset></form>}
  </>
}
export function DeliveriesPage() {
  const [tab, setTab] = useState('tasks')
  const [radius, setRadius] = useState('5000')
  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState<string | number | null>(null)
  return <Access roles={['Volunteer']}><Workspace title="Your deliveries" intro="Help food reach a table nearby.">
    <div className="workspace-toolbar"><div className="field"><label htmlFor="delivery-view">Show deliveries</label><select id="delivery-view" value={tab} onChange={event => { setTab(event.target.value); setCursor(null) }}><option value="tasks">Available tasks</option><option value="mine">My assignments</option></select></div>
      {tab === 'tasks' ? <div className="field"><label htmlFor="delivery-radius">Search radius</label><select id="delivery-radius" value={radius} onChange={event => { setRadius(event.target.value); setCursor(null) }}><option value="1000">1 km</option><option value="3000">3 km</option><option value="5000">5 km</option></select></div> : <div className="field"><label htmlFor="pickup-filter">Assignment status</label><select id="pickup-filter" value={status} onChange={event => { setStatus(event.target.value); setCursor(null) }}><option value="">All assignments</option>{['Scheduled', 'PickedUp', 'Delivered', 'Missed', 'Cancelled', 'Failed'].map(s => <option key={s}>{s}</option>)}</select></div>}
    </div>{tab === 'tasks' ? <Tasks key={`${radius}:${cursor}`} radius={radius} cursor={cursor} setCursor={setCursor} showMine={() => { setCursor(null); setTab('mine') }} /> : <Assignments status={status} cursor={cursor} setCursor={setCursor} />}
  </Workspace></Access>
}
function Tasks({ radius, cursor, setCursor, showMine }: { radius: string; cursor: string | number | null; setCursor: (v: string | number | null) => void; showMine: () => void }) {
  const query = useQuery<Rows<Task>>(`/pickup-tasks?${params({ radius_m: radius, cursor: cursor ?? 0 })}`)
  return <><button className="text-button" onClick={query.refresh} disabled={query.loading}>Refresh tasks</button><QueryStatus {...query} />{query.data && <>
    <ul className="task-list">{query.data.data.map(task => <li className="task-row" key={task.claim_id}><div><h2>{task.food_type}</h2><p>{task.quantity_kg} kg · {task.donor_name}</p><p>{(task.distance_m / 1000).toFixed(1)} km away · Collect by {date(task.expiry_window_end)}</p><p className="field-help">Pickup point: <Coordinates lat={task.pickup_lat} lon={task.pickup_long} /></p></div><AcceptTask task={task} refresh={showMine} /></li>)}</ul>
    {!query.data.data.length && <p className="list-message">No nearby tasks are waiting for a volunteer.</p>}<Pagination meta={query.data.meta} cursor={cursor} setCursor={setCursor} /></>}
  </>
}
function Assignments({ status, cursor, setCursor }: { status: string; cursor: string | number | null; setCursor: (v: string | number | null) => void }) {
  const query = useQuery<Rows<Exchange>>(`/pickups/mine?${params({ status, cursor })}`)
  return <><button className="text-button" onClick={query.refresh} disabled={query.loading}>Refresh assignments</button><QueryStatus {...query} />{query.data && <>
    <ul className="assignment-list">{query.data.data.map(exchange => <li className="assignment-row" key={`${exchange.claim_id}:${exchange.pickup_id}`}><h2>{exchange.food_type} · {exchange.pickup_status}</h2><p>{exchange.quantity_kg} kg</p><ExchangeDetails exchange={exchange} refresh={query.refresh} /></li>)}</ul>
    {!query.data.data.length && <p className="list-message">You have no assignments in this view.</p>}<Pagination meta={query.data.meta} cursor={cursor} setCursor={setCursor} /></>}
  </>
}
