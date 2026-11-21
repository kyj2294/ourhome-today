import { type FamilyRequest, type FamilyState, type SchedulePlan, currentResponse, isRequestActive } from './models'

/** '오늘 함께할 일' 화면의 찾기 기준 */
export type TogetherFilter = 'TODAY' | 'AWAITING' | 'IN_PROGRESS' | 'ALL'

export const TOGETHER_FILTERS: { key: TogetherFilter; label: string }[] = [
  { key: 'AWAITING', label: '응답 대기' },
  { key: 'TODAY', label: '오늘' },
  { key: 'IN_PROGRESS', label: '진행 중' },
  { key: 'ALL', label: '전체' },
]

export type TogetherItem = { kind: 'request'; request: FamilyRequest } | { kind: 'schedule'; plan: SchedulePlan }

const sortKey = (i: TogetherItem) =>
  i.kind === 'request' ? (i.request.dueDate ? `${i.request.dueDate}T00:00` : i.request.createdAt) : i.plan.startAt

/**
 * 필터별 항목 목록.
 * - 오늘: 오늘(또는 지난) 기한의 진행 중 부탁, 오늘 일정
 * - 응답 대기: 내가 응답할 것 (담당 없는 부탁, 아직 응답 안 했거나 재확인이 필요한 일정)
 * - 진행 중: 누군가 맡은 부탁, 다가오는 일정
 */
export function togetherItems(s: FamilyState, filter: TogetherFilter, today: string): TogetherItem[] {
  const me = s.currentUserId
  const upcoming = s.schedules.filter((p) => !p.canceled && p.startAt.slice(0, 10) >= today)
  const req = (r: FamilyRequest): TogetherItem => ({ kind: 'request', request: r })
  const sch = (p: SchedulePlan): TogetherItem => ({ kind: 'schedule', plan: p })

  let items: TogetherItem[]
  switch (filter) {
    case 'TODAY':
      items = [
        ...s.requests.filter((r) => isRequestActive(r) && !!r.dueDate && r.dueDate <= today).map(req),
        ...upcoming.filter((p) => p.startAt.slice(0, 10) === today).map(sch),
      ]
      break
    case 'AWAITING':
      items = [
        ...s.requests.filter((r) => r.status === 'OPEN' && r.audienceIds.includes(me)).map(req),
        ...upcoming.filter((p) => p.audienceIds.includes(me) && !currentResponse(p, me)).map(sch),
      ]
      break
    case 'IN_PROGRESS':
      items = [
        ...s.requests.filter((r) => r.status === 'CLAIMED' || r.status === 'IN_PROGRESS').map(req),
        ...upcoming.map(sch),
      ]
      break
    case 'ALL':
      items = [...s.requests.map(req), ...s.schedules.map(sch)]
      break
  }
  return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
}
