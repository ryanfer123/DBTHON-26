export function WhatsAppContact({ phone, claimId, name }: { phone: string; claimId: number; name: string }) {
  const digits = phone.replace(/\D/g, '')
  if (!/^\d{8,15}$/.test(digits)) return null
  const text = `Hello ${name}, I'm coordinating Second Table exchange #${claimId}. Can we confirm the handover arrangements?`
  return <a className="text-link" href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open WhatsApp message to ${name}`}>WhatsApp</a>
}
