import { describe, expect, it } from 'vitest'
import { eventsOnDay, monthMatrix, upcomingSchedules } from './calendar'
import { sampleState } from './sample'

const NOW = new Date(2026, 10, 18, 9, 0) // 2026-11-18 (수)

describe('달력', () => {
  it('2026년 11월은 일요일(11/1)부터 5주', () => {
    const m = monthMatrix(2026, 10)
    expect(m).toHaveLength(5)
    expect(m[0][0]).toBe('2026-11-01')
    expect(m[4][6]).toBe('2026-12-05')
  })

  it('앞달 날짜로 시작하는 달도 만든다 (2026년 12월은 11/29 일요일부터)', () => {
    const m = monthMatrix(2026, 11)
    expect(m[0][0]).toBe('2026-11-29')
    expect(m[m.length - 1].includes('2026-12-31')).toBe(true)
  })

  it('날짜별로 일정·부탁 기한·자동화를 모은다', () => {
    const s = sampleState(NOW)
    const sat = eventsOnDay(s, '2026-11-21') // 샘플: 다음 토요일 김장
    expect(sat.schedules.map((p) => p.title)).toEqual(['주말 김장하기'])
    expect(sat.routines.map((r) => r.times)).toEqual([['08:00', '20:00']]) // 매일 약 자동화
    const due = eventsOnDay(s, '2026-11-25') // 정수기 필터 기한 (+7일)
    expect(due.requests.map((r) => r.title)).toEqual(['정수기 필터 주문'])
    const today = eventsOnDay(s, '2026-11-18')
    expect(today.requests.map((r) => r.title)).toEqual(['엄마 건강검진 병원 예약 전화'])
  })

  it('꺼 둔 자동화와 취소된 일정은 달력에 안 보인다', () => {
    const s = sampleState(NOW)
    const off = { ...s, routines: s.routines.map((r) => ({ ...r, enabled: false })), schedules: s.schedules.map((p) => ({ ...p, canceled: true })) }
    const sat = eventsOnDay(off, '2026-11-21')
    expect(sat.schedules).toHaveLength(0)
    expect(sat.routines).toHaveLength(0)
  })

  it('다가오는 2주 일정', () => {
    expect(upcomingSchedules(sampleState(NOW), '2026-11-18').map((p) => p.title)).toEqual(['주말 김장하기'])
  })
})
