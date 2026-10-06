import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ShareListing } from '../../components/ShareListing'
import { useAuth } from '../identity/AuthContext'
import { LocationFields } from '../identity/FormParts'
import { useListLocation } from './useListLocation'
import { date, localInput, params, useCommand, useQuery, type Listing, type Resource, type Rows } from './data'
import { Access, Coordinates, Countdown, Feedback, Pagination, QueryStatus, Workspace } from './Workspace'

export function FoodPage({ own = false }: { own?: boolean }) {
  const location = useLocation()
  const list = useListLocation()
  const category = list.value('category', '', ['', 'Veg', 'NonVeg'])
  const radius = list.value('radius_m', '5000', ['1000', '3000', '5000'])
  const status = list.value('status', '', ['', 'Available', 'Claimed', 'PickedUp', 'Delivered', 'Expired', 'Cancelled'])
  const q = list.value('q').slice(0, 80)
  const { cursor, setCursor } = list
  const query = useQuery<Rows<Listing>>(`${own ? '/listings/mine' : '/listings'}?${params(own ? { status, q, cursor: cursor ?? 0 } : { category, radius_m: radius, q, cursor })}`)
  return <Access roles={[own ? 'Donor' : 'Receiver']}><Workspace title={own ? 'My donations' : 'Find nearby food'}
    intro={own ? 'Your food, from listing to delivery.' : 'Whole quantities, within your community.'}
    action={own && <Link className="button button-small" to="/donations/new">List food</Link>}>
    <div className="workspace-toolbar">
      <form className="food-search" onSubmit={event => { event.preventDefault(); list.setFilters({ q: String(new FormData(event.currentTarget).get('q')).trim() }) }}>
        <div className="field"><label htmlFor="food-search">Search food</label><input key={q} id="food-search" name="q" type="search" maxLength={80} defaultValue={q} /></div><button className="button button-outline button-small" type="submit">Search</button>
      </form>
      {own ? <div className="field"><label htmlFor="food-status">Listing status</label><select id="food-status" value={status} onChange={e => { list.setFilters({ status: e.target.value }) }}>
        <option value="">All listings</option>{['Available', 'Claimed', 'PickedUp', 'Delivered', 'Expired', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
      </select></div> : <><div className="field"><label htmlFor="radius">Search radius</label><select id="radius" value={radius} onChange={e => { list.setFilters({ radius_m: e.target.value }) }}>
        <option value="1000">1 km</option><option value="3000">3 km</option><option value="5000">5 km</option>
      </select></div><div className="field"><label htmlFor="category">Category</label><select id="category" value={category} onChange={e => { list.setFilters({ category: e.target.value }) }}>
        <option value="">All food</option><option value="Veg">Vegetarian</option><option value="NonVeg">Non-vegetarian</option>
      </select></div></>}
      <button className="text-button" onClick={list.clear}>Clear filters</button><button className="text-button" onClick={query.refresh} disabled={query.loading}>Refresh food</button>
    </div>
    {!own && <p className="field-help">Distances are straight-line estimates from your saved account location, not road travel distances.</p>}
    <QueryStatus {...query} />
    {query.data && <><ul className="food-list">{query.data.data.map(food => <li className="food-row" key={food.listing_id}>
      <div className="food-name"><h2>{food.food_type}</h2><p>{food.donor_name}</p><span className="food-tag">{food.category === 'Veg' ? 'Vegetarian' : 'Non-vegetarian'}</span><strong className="food-weight">{food.quantity_kg} kg</strong></div>
      <div className="food-timing"><p>Prepared {date(food.prepared_at)}</p><p>Collect by {date(food.expiry_window_end)}</p><span className="field-help">{food.distance_m !== null ? `${(food.distance_m / 1000).toFixed(1)} km away` : food.status}</span></div>
      <div>{['Available', 'Claimed', 'PickedUp'].includes(food.status) ? <Countdown key={query.data!.meta.server_time} end={food.expiry_window_end} serverTime={query.data!.meta.server_time} /> : <strong>{food.status}</strong>}</div>
      <Link className="button button-outline button-small" to={`/food/${food.listing_id}`} state={{ parent: location.pathname + location.search }}>View food</Link>
    </li>)}</ul>
      {!query.data.data.length && <div className="empty-state"><h2>{own ? 'Your first donation starts here.' : 'No food matches this search.'}</h2><p>{own ? 'Add the food you can share and its collection window.' : 'Try a wider radius or category. Only live listings within your receiving capacity appear.'}</p>{own && <Link className="text-link" to="/donations/new">List your food</Link>}</div>}
      <Pagination previous={list.previous} meta={query.data.meta} cursor={cursor} setCursor={setCursor} />
      <p className="workspace-note">Collection deadlines are provided by donors. Check preparation and handling before accepting food.</p>
    </>}
  </Workspace></Access>
}

function ReasonForm({ label, busy, onSubmit }: { label: string; busy: boolean; onSubmit: (reason: string) => Promise<void> }) {
  return <form className="reason-form" onSubmit={event => { event.preventDefault(); void onSubmit(String(new FormData(event.currentTarget).get('reason')).trim()) }}>
    <fieldset className="form-fields" disabled={busy}><div className="field"><label htmlFor="cancel-reason">Cancellation reason</label><textarea id="cancel-reason" name="reason" minLength={3} maxLength={300} rows={2} required /></div>
      <button className="button button-outline button-small" type="submit">{busy ? 'Saving…' : label}</button></fieldset>
  </form>
}

export function FoodDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const query = useQuery<Resource<Listing>>(`/listings/${id}`)
  const command = useCommand()
  const [cancelling, setCancelling] = useState(false)
  const food = query.data?.data
  const owner = food?.donor_id === session?.user.user_id
  const receiver = session?.user.capabilities.includes('Receiver')
  const live = !!food && food.status === 'Available' && food.seconds_remaining > 0
  return <Workspace title={food?.food_type ?? 'Food details'} intro="Check the whole quantity and collection window.">
    <QueryStatus {...query} /><Feedback {...command} />
    {food && query.data && <div className="detail-layout"><section>
      <p className="detail-emphasis">{food.quantity_kg} kg · {food.category === 'Veg' ? 'Vegetarian' : 'Non-vegetarian'}</p>
      <dl className="detail-list"><dt>Shared by</dt><dd>{food.donor_name}</dd><dt>Status</dt><dd>{food.status}</dd><dt>Prepared</dt><dd>{date(food.prepared_at)}</dd><dt>Collection opens</dt><dd>{date(food.expiry_window_start)}</dd><dt>Collect by</dt><dd>{date(food.expiry_window_end)}</dd><dt>Pickup point</dt><dd><Coordinates lat={food.pickup_lat} lon={food.pickup_long} /></dd></dl>
      <button className="text-button" onClick={query.refresh} disabled={query.loading}>Refresh this listing</button>
      <ShareListing listingId={food.listing_id} />
    </section><aside className="workflow-aside">
      {['Available', 'Claimed', 'PickedUp'].includes(food.status) && <Countdown key={query.data!.meta.server_time} end={food.expiry_window_end} serverTime={query.data!.meta.server_time} />}
      {owner ? <><h2>Your donation</h2><p>{live ? 'You can edit this listing until a receiver claims it.' : 'Its allocation history is kept in your exchanges.'}</p>
        <div className="actions">{live && <Link className="button button-small" to={`/donations/${food.listing_id}/edit`}>Edit listing</Link>}<Link className="text-link" to="/claims">View exchanges</Link></div>
        {['Available', 'Claimed'].includes(food.status) && <><button className="text-button" onClick={() => setCancelling(value => !value)}>{cancelling ? 'Keep listing' : 'Cancel listing'}</button>
          {cancelling && <ReasonForm label="Confirm cancellation" busy={command.busy} onSubmit={async reason => {
            if (await command.run(`/listings/${food.listing_id}/cancel`, { reason })) { setCancelling(false); command.setNotice('Listing cancelled.'); query.refresh() }
          }} />}</>}
      </> : receiver ? <><h2>Claim the whole quantity</h2><p>Claiming reserves this food for you. A volunteer can then arrange collection and delivery.</p>
        <button className="button button-small" disabled={command.busy || !live} onClick={async () => {
          const result = await command.run(`/listings/${food.listing_id}/claims`)
          if (result) navigate(`/claims/${result.data.claim_id}`)
        }}>{command.busy ? 'Reserving…' : live ? `Claim ${food.quantity_kg} kg` : 'Food unavailable'}</button>
      </> : <p>This listing is visible within your community. Claiming requires an approved Receiver role.</p>}
      <p className="field-help">The server rechecks the deadline, distance, capacity and availability when you act.</p>
    </aside></div>}
  </Workspace>
}

function ListingForm({ food }: { food?: Listing }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const command = useCommand()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = { food_type: String(form.get('food_type')).trim(), category: form.get('category'), quantity_kg: form.get('quantity_kg'),
      prepared_at: new Date(String(form.get('prepared_at'))).toISOString(), expiry_window_start: new Date(String(form.get('start'))).toISOString(),
      expiry_window_end: new Date(String(form.get('end'))).toISOString(), pickup_lat: form.get('latitude'), pickup_long: form.get('longitude') }
    const result = await command.run(food ? `/listings/${food.listing_id}` : '/listings', body, food ? 'PATCH' : 'POST')
    if (result) navigate(`/food/${result.data.listing_id}`)
  }
  return <form onSubmit={submit} className="listing-form"><fieldset disabled={command.busy} className="form-fields">
    <div className="field"><label htmlFor="food-name">Food name</label><input id="food-name" name="food_type" required maxLength={80} pattern=".*\S.*" defaultValue={food?.food_type ?? ''} /></div>
    <div className="field-row"><div className="field"><label htmlFor="food-category">Category</label><select id="food-category" name="category" defaultValue={food?.category ?? 'Veg'}><option value="Veg">Vegetarian</option><option value="NonVeg">Non-vegetarian</option></select></div>
      <div className="field"><label htmlFor="quantity">Whole quantity (kg)</label><input id="quantity" name="quantity_kg" type="number" min="0.01" max="999999.99" step="0.01" required defaultValue={food?.quantity_kg ?? ''} /></div></div>
    <div className="field"><label htmlFor="prepared">Prepared at</label><input id="prepared" name="prepared_at" type="datetime-local" required defaultValue={food ? localInput(new Date(food.prepared_at)) : ''} /></div>
    <div className="field-row"><div className="field"><label htmlFor="collection-start">Collection opens</label><input id="collection-start" name="start" type="datetime-local" required defaultValue={food ? localInput(new Date(food.expiry_window_start)) : ''} /></div>
      <div className="field"><label htmlFor="collection-end">Collect by</label><input id="collection-end" name="end" type="datetime-local" required defaultValue={food ? localInput(new Date(food.expiry_window_end)) : ''} /></div></div>
    <p className="field-help">Times use your device’s timezone. Preparation must precede collection; the deadline must be in the future and within seven days.</p>
    <LocationFields legend="Pickup point" latitude={food?.pickup_lat ?? session!.user.latitude} longitude={food?.pickup_long ?? session!.user.longitude} />
    <Feedback {...command} /><div className="actions"><button className="button button-small" type="submit">{command.busy ? 'Saving…' : food ? 'Save listing' : 'Publish listing'}</button><Link className="text-link" to={food ? `/food/${food.listing_id}` : '/donations'}>Back</Link></div>
  </fieldset></form>
}
export function ListingEditorPage() {
  const { id } = useParams()
  // Separate edit loading from the create form; never fetch a fictional listing.
  return <Access roles={['Donor']}><Workspace title={id ? 'Edit your listing' : 'Share some food'} intro="Add the quantity, preparation time and collection deadline.">
    {id ? <EditListing id={id} /> : <ListingForm />}
  </Workspace></Access>
}
function EditListing({ id }: { id: string }) {
  const { session } = useAuth()
  const query = useQuery<Resource<Listing>>(`/listings/${id}`)
  return <><QueryStatus {...query} />{query.data && (query.data.data.donor_id === session!.user.user_id && query.data.data.status === 'Available' && query.data.data.seconds_remaining > 0 ?
    <ListingForm key={id} food={query.data.data} /> : <p className="notice">This listing can no longer be edited.</p>)}</>
}
