/**
 * 우리집 오늘 — 도메인 모델
 *
 * 설계 원칙(기획서 기준)
 * - 가족 소식(Post)은 소식으로 끝나도 된다. 일정/부탁은 글쓴이가 직접 선택할 때만 연결된다.
 * - 읽음 / 의사 표현 / 담당 수락 / 처리 상태를 하나의 "확인" 버튼으로 합치지 않는다.
 * - 부모·자녀 역할을 권한으로 나누지 않는다. 항목마다 요청자·응답자·담당자가 달라진다.
 *
 * 날짜 표기
 * - 시각(createdAt 등): ISO 문자열 (new Date().toISOString())
 * - 날짜(dueDate): 'YYYY-MM-DD'
 * - 일정 시작(startAt): 로컬 시각 'YYYY-MM-DDTHH:mm'
 */

export interface Member {
  id: string
  /** 가족 안에서 부르는 이름 (예: 엄마, 민수) */
  name: string
  /** 관계 설명 (예: 어머니, 아들). 권한과 무관하다. */
  relation: string
  color: string
}

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string
}

export interface Post {
  id: string
  authorId: string
  text: string
  /** 이미지 data URL 또는 "sample:설명" 자리표시 */
  photos: string[]
  createdAt: string
  /** 읽음은 의사 표현·담당과 별개로 기록한다. */
  readBy: string[]
  comments: Comment[]
  linkedRequestId?: string
  linkedScheduleId?: string
}

export interface HistoryEntry {
  actorId: string
  message: string
  at: string
}

/** 아직 맡은 사람 없음 → 제가 챙길게요 → 진행(주문했어요) → 완료(받았어요) / 취소 */
export type RequestStatus = 'OPEN' | 'CLAIMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'

export interface PurchaseSpec {
  spec: string
  quantity: number
}

export interface FamilyRequest {
  id: string
  sourcePostId?: string
  requesterId: string
  title: string
  detail: string
  dueDate?: string
  /** 부탁을 공유한 가족 (요청자 제외) */
  audienceIds: string[]
  purchase?: PurchaseSpec
  assigneeId?: string
  status: RequestStatus
  seenBy: string[]
  history: HistoryEntry[]
  createdAt: string
}

export type Availability = 'AVAILABLE' | 'RESCHEDULE' | 'UNAVAILABLE'

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  AVAILABLE: '가능해요',
  RESCHEDULE: '시간 바꿔요',
  UNAVAILABLE: '이번엔 어려워요',
}

export interface ScheduleResponse {
  memberId: string
  availability: Availability
  note?: string
  /** 어떤 일정 버전(날짜·시간)에 대한 응답인지. 시간이 바뀌면 재확인 대상이 된다. */
  version: number
  at: string
}

export interface SchedulePlan {
  id: string
  sourcePostId?: string
  proposerId: string
  title: string
  startAt: string
  place?: string
  /** 응답을 요청받은 가족 (제안자 제외) */
  audienceIds: string[]
  responses: Record<string, ScheduleResponse>
  version: number
  confirmed: boolean
  canceled: boolean
  history: HistoryEntry[]
  createdAt: string
}

export type NotificationTarget =
  | { kind: 'post'; id: string }
  | { kind: 'request'; id: string }
  | { kind: 'schedule'; id: string }

export interface AppNotification {
  id: string
  recipientId: string
  message: string
  target: NotificationTarget
  at: string
  read: boolean
}

export interface FamilyState {
  /** 저장 형식 버전 (구조가 바뀌면 올린다) */
  schema: number
  familyName: string
  inviteCode: string
  members: Member[]
  /** 지금 앱을 쓰는 사람 (프로토타입에서는 가족 화면에서 전환) */
  currentUserId: string
  posts: Post[]
  requests: FamilyRequest[]
  schedules: SchedulePlan[]
  notifications: AppNotification[]
}

// ---------------------------------------------------------------------------
// 조회 헬퍼
// ---------------------------------------------------------------------------

export const memberOf = (s: FamilyState, id?: string) => s.members.find((m) => m.id === id)
export const nameOf = (s: FamilyState, id?: string) => memberOf(s, id)?.name ?? '알 수 없음'
export const postOf = (s: FamilyState, id?: string) => (id ? s.posts.find((p) => p.id === id) : undefined)
export const requestOf = (s: FamilyState, id?: string) => (id ? s.requests.find((r) => r.id === id) : undefined)
export const scheduleOf = (s: FamilyState, id?: string) => (id ? s.schedules.find((p) => p.id === id) : undefined)

export const otherMemberIds = (s: FamilyState) => s.members.map((m) => m.id).filter((id) => id !== s.currentUserId)

export const isRequestActive = (r: FamilyRequest) =>
  r.status === 'OPEN' || r.status === 'CLAIMED' || r.status === 'IN_PROGRESS'

export function requestStatusLabel(r: FamilyRequest): string {
  switch (r.status) {
    case 'OPEN':
      return '아직 맡은 사람 없음'
    case 'CLAIMED':
      return '맡았어요'
    case 'IN_PROGRESS':
      return r.purchase ? '주문했어요' : '진행 중'
    case 'DONE':
      return r.purchase ? '받았어요' : '완료'
    case 'CANCELED':
      return '취소됨'
  }
}

/** 현재 버전에 대한 응답만 유효한 응답으로 본다. */
export const currentResponse = (p: SchedulePlan, memberId: string) => {
  const r = p.responses[memberId]
  return r && r.version === p.version ? r : undefined
}

/** 예전 시간에 응답했는데 시간이 바뀐 경우 → 재확인 필요 */
export const needsReconfirm = (p: SchedulePlan, memberId: string) => {
  const r = p.responses[memberId]
  return !!r && r.version < p.version
}

export const scheduleStatusLabel = (p: SchedulePlan) => (p.canceled ? '취소됨' : p.confirmed ? '확정' : '조율 중')

export const myNotifications = (s: FamilyState) =>
  s.notifications.filter((n) => n.recipientId === s.currentUserId).sort((a, b) => b.at.localeCompare(a.at))

export const unreadCount = (s: FamilyState) =>
  s.notifications.filter((n) => n.recipientId === s.currentUserId && !n.read).length
