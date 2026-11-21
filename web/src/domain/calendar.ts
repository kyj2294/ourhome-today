/**
 * 달력 — 날짜별로 일정·부탁 기한·자동화를 모은다.
 */
import { addDays, parseLocal, toDateKey } from './dates'
import { type FamilyRequest, type FamilyState, type Routine, type SchedulePlan, isRequestActive } from './models'

export interface DayEvents {
  schedules: SchedulePlan[]
  /** 이 날이 기한인 진행 중 부탁 */
  requests: FamilyRequest[]
  /** 이 날 울리는 자동화와 시각들 */
  routines: { routine: Routine; times: string[] }[]
}

export function eventsOnDay(s: FamilyState, dateKey: string): DayEvents {
  const weekday = parseLocal(dateKey).getDay()
  return {
    schedules: s.schedules.filter((p) => !p.canceled && p.startAt.slice(0, 10) === dateKey).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    requests: s.requests.filter((r) => isRequestActive(r) && r.dueDate === dateKey),
    routines: s.routines
      .filter((r) => r.enabled && r.days.includes(weekday) && dateKey >= r.createdAt.slice(0, 10))
      .map((routine) => ({ routine, times: [...routine.times].sort() })),
  }
}

/** 달력 칸: 월요일이 아니라 일요일부터 시작하는 주 단위 날짜 목록 (앞뒤 달 날짜 포함) */
export function monthMatrix(year: number, month0: number): string[][] {
  const first = new Date(year, month0, 1)
  const start = addDays(toDateKey(first), -first.getDay())
  const weeks: string[][] = []
  let cursor = start
  do {
    const week: string[] = []
    for (let i = 0; i < 7; i++) {
      week.push(cursor)
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  } while (parseLocal(cursor).getMonth() === month0)
  return weeks
}

/** 오늘부터 days일 안의 일정 (부모님 화면 '다가오는 가족 일정') */
export function upcomingSchedules(s: FamilyState, today: string, days = 14): SchedulePlan[] {
  const end = addDays(today, days)
  return s.schedules
    .filter((p) => !p.canceled && p.startAt.slice(0, 10) >= today && p.startAt.slice(0, 10) <= end)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
}
