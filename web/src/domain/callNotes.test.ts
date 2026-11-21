import { describe, expect, it } from 'vitest'
import { dateKeyOf, extractFromCallNote, findDate, findTime } from './callNotes'

const NOW = new Date(2026, 10, 18, 9, 0) // 2026-11-18 (수)

describe('날짜 찾기', () => {
  it.each([
    ['오늘 저녁', '2026-11-18'],
    ['내일 가요', '2026-11-19'],
    ['모레', '2026-11-20'],
    ['토요일에 갈게', '2026-11-21'],
    ['이번 주 토요일', '2026-11-21'],
    ['다음 주 월요일', '2026-11-23'],
    ['다음주 토요일', '2026-11-28'],
    ['주말에', '2026-11-21'],
    ['12월 3일', '2026-12-03'],
    ['25일에', '2026-11-25'],
    ['5일에', '2026-12-05'],
  ])('%s → %s', (text, key) => {
    expect(dateKeyOf(findDate(text, NOW))).toBe(key)
  })

  it('날짜가 없으면 null', () => {
    expect(findDate('건전지 사 와', NOW)).toBeNull()
  })
})

describe('시간 찾기', () => {
  it.each([
    ['오후 2시', [14, 0]],
    ['오전 10시 반', [10, 30]],
    ['저녁 7시', [19, 0]],
    ['3시', [15, 0]],
    ['11시 20분', [11, 20]],
    ['점심 먹자', [12, 0]],
  ])('%s', (text, hm) => {
    expect(findTime(text)).toEqual(hm)
  })
})

describe('통화 메모 정리', () => {
  it('일정과 부탁을 함께 찾는다', () => {
    const s = extractFromCallNote('토요일 오후 2시에 김장하러 오기로 했어. 그리고 건전지도 사 오기로 했어', NOW)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ kind: 'schedule', startAt: '2026-11-21T14:00' })
    expect(s[0].title).toContain('김장')
    expect(s[1]).toMatchObject({ kind: 'request', purchase: true })
    expect(s[1].title).toContain('건전지')
  })

  it('구매가 아닌 부탁도 찾는다', () => {
    const s = extractFromCallNote('병원 예약 좀 알아봐 줘', NOW)
    expect(s).toEqual([expect.objectContaining({ kind: 'request', purchase: false })])
  })

  it('정한 게 없으면 빈 목록', () => {
    expect(extractFromCallNote('그냥 안부 전화했어 잘 지내', NOW)).toEqual([])
  })
})
