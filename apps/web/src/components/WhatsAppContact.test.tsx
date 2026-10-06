import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { WhatsAppContact } from './WhatsAppContact'

it('prepares a handover message for an international number without sending it', () => {
  render(<WhatsAppContact name="Synthetic Receiver" phone="+1 202-555-0101" claimId={501} />)
  const link = screen.getByRole('link')
  const destination = new URL(link.getAttribute('href')!)
  expect(destination.origin).toBe('https://wa.me')
  expect(destination.pathname).toBe('/12025550101')
  expect(destination.searchParams.get('text')).toContain('Second Table exchange #501')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

it('does not offer a broken contact link for a missing number', () => {
  render(<WhatsAppContact name="Synthetic Receiver" phone="" claimId={501} />)
  expect(screen.queryByRole('link')).toBeNull()
})
