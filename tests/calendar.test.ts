import { describe, expect, it } from 'vitest'
import { buildIcal } from '../supabase/functions/calendar/ical'

describe('calendar subscription feed', () => {
  it('creates all-day calendar events, escaping calendar text and omitting skipped work', () => {
    const ics = buildIcal([
      { id: 'read', name: 'Ler, estudar; praticar', description: 'Capítulo 1\nSem atalhos', day: '2026-09-22', status: 'completed' },
      { id: 'skip', name: 'Ignorada', day: '2026-09-22', status: 'skipped' },
    ], 'Agenda, pessoal')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260922')
    expect(ics).toContain('DTEND;VALUE=DATE:20260923')
    expect(ics).toContain('SUMMARY:✓ Ler\\, estudar\\; praticar')
    expect(ics).toContain('DESCRIPTION:Capítulo 1\\nSem atalhos')
    expect(ics).not.toContain('Ignorada')
  })
})
