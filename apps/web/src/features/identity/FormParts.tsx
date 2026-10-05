import { useState } from 'react'

export function PasswordField({ newPassword = false }: { newPassword?: boolean }) {
  const [visible, setVisible] = useState(false)
  return <div className="field"><label htmlFor="password">Password</label>
    <div className="password-control"><input id="password" name="password" type={visible ? 'text' : 'password'}
      minLength={12} maxLength={128} required autoComplete={newPassword ? 'new-password' : 'current-password'} aria-describedby="password-help" />
      <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
        onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button>
    </div><small id="password-help">Use 12–128 characters.</small>
  </div>
}

export function LocationFields({ latitude = '', longitude = '', legend = 'Your location' }: { latitude?: string; longitude?: string; legend?: string }) {
  const [lat, setLat] = useState(latitude)
  const [lon, setLon] = useState(longitude)
  const [message, setMessage] = useState('')
  const [locating, setLocating] = useState(false)
  return <fieldset className="location-fields"><legend>{legend}</legend>
    <p className="field-help">Enter coordinates or use your current location to connect locally.</p>
    <div className="field-row">
      <div className="field"><label htmlFor="latitude">Latitude</label><input id="latitude" name="latitude" type="number"
        step="0.000001" min="-90" max="90" required value={lat} onChange={e => setLat(e.target.value)} /></div>
      <div className="field"><label htmlFor="longitude">Longitude</label><input id="longitude" name="longitude" type="number"
        step="0.000001" min="-180" max="180" required value={lon} onChange={e => setLon(e.target.value)} /></div>
    </div>
    <button type="button" className="text-button" disabled={locating} onClick={() => {
      if (!navigator.geolocation) { setMessage('Location is unavailable. Enter your coordinates above.'); return }
      setLocating(true); setMessage('')
      navigator.geolocation.getCurrentPosition(position => {
        setLat(position.coords.latitude.toFixed(6)); setLon(position.coords.longitude.toFixed(6))
        setMessage('Location added. Check the coordinates before saving.'); setLocating(false)
      }, () => { setMessage('Location could not be obtained. You can enter coordinates above.'); setLocating(false) },
      { timeout: 10000, maximumAge: 60000 })
    }}>{locating ? 'Finding your location…' : 'Use my current location'}</button>
    {message && <p role="status" className="field-help">{message}</p>}
  </fieldset>
}

export function ContactFields({ name = '', phone = '' }: { name?: string; phone?: string }) {
  return <>
    <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required maxLength={100} autoComplete="name" defaultValue={name} pattern=".*\S.*" /></div>
    <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" required autoComplete="tel"
      pattern="\+[1-9][0-9]{7,14}" defaultValue={phone} aria-describedby="phone-help" />
      <small id="phone-help">Include + and your country code, followed by 8–15 digits.</small></div>
  </>
}
