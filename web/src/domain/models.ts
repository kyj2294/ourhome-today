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

/** 부모님 / 자녀 — 화면 구성(쉬운 화면 vs 전체 기능)을 정한다. 규칙상 권한은 같다. */
export type Role = 'parent' | 'child'

export const ROLE_LABEL: Record<Role, string> = { parent: '부모님', child: '자녀' }

export interface Member {
  id: string
  role: Role
  /** 가족 안에서 부르는 이름 (예: 엄마, 민수) */
  name: string
  /** 관계 설명 (예: 어머니, 아들) */
  relation: string
  color: string
  /** 바로 전화하기에 쓰는 번호 (선택) */
  phone?: string
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

// ---------------------------------------------------------------------------
// 안부 질문 — "약 드셨어요?" 같은 질문에 버튼 하나로 답한다
// ---------------------------------------------------------------------------

export interface QuestionAnswer {
  option: string
  at: string
}

/** 카카오톡 선물하기처럼 메시지를 담는 카드 디자인 */
export type CardDesign = 'pill' | 'meal' | 'love' | 'thanks' | 'cheer' | 'birthday'

export const CARD_DESIGNS: { id: CardDesign; emoji: string; title: string; message: string }[] = [
  { id: 'pill', emoji: '💊', title: '약 챙기기', message: '오늘도 약 꼭 챙겨 드세요!' },
  { id: 'meal', emoji: '🍚', title: '든든한 한 끼', message: '식사 거르지 마시고 맛있게 드세요.' },
  { id: 'love', emoji: '❤️', title: '사랑해요', message: '늘 고맙고 사랑해요.' },
  { id: 'thanks', emoji: '🌷', title: '고마워요', message: '항상 챙겨 주셔서 고마워요.' },
  { id: 'cheer', emoji: '☀️', title: '힘내세요', message: '오늘 하루도 기운 내세요!' },
  { id: 'birthday', emoji: '🎂', title: '축하해요', message: '생신 축하드려요! 건강하세요.' },
]

export const cardOf = (id?: CardDesign) => CARD_DESIGNS.find((c) => c.id === id)

/** 마음 카드(질문 없이 보내는 카드)에 붙는 답 버튼 */
export const CARD_REPLY_OPTIONS = ['고마워 ❤️', '나도 사랑해 😊']

export interface FamilyQuestion {
  id: string
  askerId: string
  /** 카드에 담아 보낸 경우 */
  card?: CardDesign
  /** 카드 메시지 */
  message?: string
  /** 자동 안부(반복)로 보내진 경우 */
  routineId?: string
  /** 답이 필요 없는 알림 (버튼은 '알겠어요' 하나) */
  reminder?: boolean
  /** 답해 줄 가족 (보통 부모님) */
  targetIds: string[]
  text: string
  /** 답 버튼 2~3개 */
  options: string[]
  answers: Record<string, QuestionAnswer>
  createdAt: string
}

/**
 * 자동 안부 — 알람처럼 정한 요일·시간에 질문을 보낸다.
 * 서버가 없는 프로토타입에서는 앱이 열려 있거나 다음에 열릴 때 보낸다(밀린 건 가장 최근 1번만).
 */
export interface Routine {
  id: string
  ownerId: string
  targetIds: string[]
  text: string
  options: string[]
  card?: CardDesign
  message?: string
  reminder?: boolean
  /** 0(일)~6(토) */
  days: number[]
  /** 'HH:mm' 여러 개 */
  times: string[]
  enabled: boolean
  /** 마지막으로 보낸 회차의 예정 시각 (ISO) */
  lastFiredAt?: string
  createdAt: string
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function describeDays(days: number[]): string {
  const set = [...new Set(days)].sort()
  if (set.length === 7) return '매일'
  if (set.join() === '1,2,3,4,5') return '평일'
  if (set.join() === '0,6') return '주말'
  return [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)].map((d) => DAY_LABELS[d]).join('·')
}

export function describeTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ''}`
}

/** 질문 빠른 선택 (자녀 화면) */
export const QUESTION_PRESETS: { icon: string; text: string; options: string[] }[] = [
  { icon: '💊', text: '약 드셨어요?', options: ['먹었어요', '아직이요', '이따 먹을게요'] },
  { icon: '🍚', text: '식사하셨어요?', options: ['먹었어요', '아직이요'] },
  { icon: '😊', text: '오늘 몸은 괜찮으세요?', options: ['괜찮아요', '조금 안 좋아요', '전화해 줘'] },
  { icon: '🏥', text: '병원 잘 다녀오셨어요?', options: ['잘 다녀왔어요', '아직 안 갔어요'] },
]

/** 알림(답 필요 없음)에 붙는 확인 버튼 */
export const REMINDER_OPTION = '알겠어요 👍'

/** 이 답을 고르면 질문한 사람 화면에 전화 버튼을 바로 보여준다 */
export const CALL_ME_OPTION = '전화해 줘'

export type NotificationTarget =
  | { kind: 'post'; id: string }
  | { kind: 'question'; id: string }
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
  questions: FamilyQuestion[]
  routines: Routine[]
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

export const questionOf = (s: FamilyState, id?: string) => (id ? s.questions.find((q) => q.id === id) : undefined)

export const myNotifications = (s: FamilyState) =>
  s.notifications.filter((n) => n.recipientId === s.currentUserId).sort((a, b) => b.at.localeCompare(a.at))

export const unreadCount = (s: FamilyState) =>
  s.notifications.filter((n) => n.recipientId === s.currentUserId && !n.read).length
