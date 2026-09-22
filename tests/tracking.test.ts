import { describe, expect, it } from 'vitest'
import { addDays, execution, offensiveTime, statistics, todayIn, weekStart, type DailyLog, type Offensive, type Summary } from '../src/domain/tracking'

describe('Calendar and consistency', () => {
  it('uses calendar days across leap years and timezone boundaries', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
    expect(todayIn('America/Sao_Paulo', new Date('2026-09-23T01:00:00Z'))).toBe('2026-09-22')
    expect(weekStart('2026-09-27')).toBe('2026-09-21')
  })
  it('keeps elapsed days separate from current day and clamps the period', () => {
    const offensive = { start_date: '2026-01-01', duration_days: 30 } as Offensive
    expect(offensiveTime(offensive, '2026-01-01')).toEqual({ elapsed: 0, current: 1, remaining: 30, temporal: 0 })
    expect(offensiveTime(offensive, '2026-01-31')).toEqual({ elapsed: 30, current: 30, remaining: 0, temporal: 100 })
    expect(offensiveTime(offensive, '2025-12-31').current).toBe(0)
  })
  it('excludes unplanned days and keeps today partial without breaking yesterday’s streak', () => {
    const rows = [100, null, 100, 50].map((value, index) => ({ day: `2026-09-${21 + index}`, execution_percent: value })) as Summary[]
    const result = statistics(rows, '2026-09-24')
    expect(result.average).toBe(100)
    expect(result.streak).toBe(2)
    expect(result.unplanned).toBe(1)
    expect(result.zero).toBe(0)
  })
  it('counts missed planned days as zero and breaks the streak', () => {
    const rows = [{ day: '2026-09-21', execution_percent: 100 }, { day: '2026-09-22', execution_percent: 0 }] as Summary[]
    expect(statistics(rows, '2026-09-23')).toMatchObject({ average: 50, zero: 1, streak: 0, best: 1 })
  })
  it('uses planned weight and distinguishes no plan from zero execution', () => {
    const rows = [{ weight_snapshot: 2, status: 'completed' }, { weight_snapshot: 1, status: 'planned' }, { weight_snapshot: 10, status: 'skipped' }] as DailyLog[]
    expect(execution(rows).percent).toBeCloseTo(66.6667)
    expect(execution([]).percent).toBeNull()
  })
})
