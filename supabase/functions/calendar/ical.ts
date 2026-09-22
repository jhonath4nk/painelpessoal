export type CalendarTask = { id: string; name: string; description?: string | null; day: string; status?: 'planned' | 'completed' | 'skipped' }

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const compactDate = (day: string) => day.replaceAll('-', '')
const tomorrow = (day: string) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10) }

export function buildIcal(tasks: CalendarTask[], calendarName = 'Evolução — agenda') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Evolução//Agenda pessoal//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(calendarName)}`]
  for (const task of tasks.filter(task => task.status !== 'skipped')) {
    const title = task.status === 'completed' ? `✓ ${task.name}` : task.name
    rows.push('BEGIN:VEVENT', `UID:${task.id}-${compactDate(task.day)}@evolucao`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compactDate(task.day)}`, `DTEND;VALUE=DATE:${compactDate(tomorrow(task.day))}`, `SUMMARY:${escape(title)}`)
    if (task.description) rows.push(`DESCRIPTION:${escape(task.description)}`)
    rows.push('STATUS:CONFIRMED', 'END:VEVENT')
  }
  rows.push('END:VCALENDAR')
  return `${rows.join('\r\n')}\r\n`
}
