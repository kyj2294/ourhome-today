/**
 * 비즈니스 규칙 — 누가 무엇을 할 수 있는지, 상태가 어떻게 바뀌는지, 누구에게 알리는지.
 *
 * 모든 함수는 순수 함수다: (현재 상태, 컨텍스트, 입력) → 새 상태 또는 거절 사유.
 * 그래서 브라우저 저장소든 서버든 같은 규칙을 그대로 재사용할 수 있다.
 * (서버를 붙이면 '중복 수락 방지' 같은 규칙은 서버 트랜잭션에서도 한 번 더 확인해야 한다.)
 */
import {
  type AppNotification,
  type Availability,
  AVAILABILITY_LABEL,
  type FamilyQuestion,
  type FamilyRequest,
  type FamilyState,
  type HistoryEntry,
  type NotificationTarget,
  type Post,
  type PurchaseSpec,
  type Role,
  type SchedulePlan,
  isRequestActive,
  nameOf,
  postOf,
  questionOf,
  requestOf,
  requestStatusLabel,
  scheduleOf,
} from './models'
import { formatDateTime } from './dates'

export interface Ctx {
  /** 현재 시각 ISO 문자열 */
  now(): string
  newId(prefix: string): string
}

export type Outcome = { ok: true; state: FamilyState; id?: string } | { ok: false; message: string }

const reject = (message: string): Outcome => ({ ok: false, message })

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function notify(
  s: FamilyState,
  ctx: Ctx,
  recipients: (string | undefined)[],
  message: string,
  target: NotificationTarget,
): AppNotification[] {
  const uniq = [...new Set(recipients.filter((r): r is string => !!r && r !== s.currentUserId))]
  return uniq.map((recipientId) => ({ id: ctx.newId('n'), recipientId, message, target, at: ctx.now(), read: false }))
}

const entry = (s: FamilyState, ctx: Ctx, message: string): HistoryEntry => ({
  actorId: s.currentUserId,
  message,
  at: ctx.now(),
})

function withRequest(
  s: FamilyState,
  id: string,
  update: (r: FamilyRequest) => FamilyRequest,
  notifications: (r: FamilyRequest) => AppNotification[] = () => [],
): Outcome {
  let updated: FamilyRequest | undefined
  const requests = s.requests.map((r) => (r.id === id ? (updated = update(r)) : r))
  return { ok: true, state: { ...s, requests, notifications: [...s.notifications, ...notifications(updated!)] } }
}

function withSchedule(
  s: FamilyState,
  id: string,
  update: (p: SchedulePlan) => SchedulePlan,
  notifications: (p: SchedulePlan) => AppNotification[] = () => [],
): Outcome {
  let updated: SchedulePlan | undefined
  const schedules = s.schedules.map((p) => (p.id === id ? (updated = update(p)) : p))
  return { ok: true, state: { ...s, schedules, notifications: [...s.notifications, ...notifications(updated!)] } }
}

const myName = (s: FamilyState) => nameOf(s, s.currentUserId)

// ---------------------------------------------------------------------------
// 가족 / 구성원
// ---------------------------------------------------------------------------

export function switchUser(s: FamilyState, memberId: string): Outcome {
  if (!s.members.some((m) => m.id === memberId)) return reject('가족 구성원을 찾을 수 없어요.')
  return { ok: true, state: { ...s, currentUserId: memberId } }
}

const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ba68c8', '#ffb74d', '#4db6ac', '#f06292', '#90a4ae']

export function addMember(s: FamilyState, ctx: Ctx, name: string, relation: string, role: Role): Outcome {
  const n = name.trim()
  if (!n) return reject('이름을 적어 주세요.')
  if (s.members.some((m) => m.name === n)) return reject('같은 이름의 가족이 이미 있어요.')
  const member = { id: ctx.newId('m'), role, name: n, relation: relation.trim(), color: COLORS[s.members.length % COLORS.length] }
  return { ok: true, state: { ...s, members: [...s.members, member] }, id: member.id }
}

export function setMemberPhone(s: FamilyState, memberId: string, phone: string): Outcome {
  const digits = phone.replace(/[^0-9+]/g, '')
  if (digits && digits.replace('+', '').length < 8) return reject('전화번호를 다시 확인해 주세요.')
  if (!s.members.some((m) => m.id === memberId)) return reject('가족 구성원을 찾을 수 없어요.')
  return {
    ok: true,
    state: { ...s, members: s.members.map((m) => (m.id === memberId ? { ...m, phone: phone.trim() || undefined } : m)) },
  }
}

export function renameFamily(s: FamilyState, name: string): Outcome {
  if (!name.trim()) return reject('가족 이름을 적어 주세요.')
  return { ok: true, state: { ...s, familyName: name.trim() } }
}

// ---------------------------------------------------------------------------
// 가족 소식
// ---------------------------------------------------------------------------

export function createPost(s: FamilyState, ctx: Ctx, text: string, photos: string[]): Outcome {
  if (!text.trim() && photos.length === 0) return reject('사진이나 글을 넣어 주세요.')
  const post: Post = {
    id: ctx.newId('p'),
    authorId: s.currentUserId,
    text: text.trim(),
    photos,
    createdAt: ctx.now(),
    readBy: [s.currentUserId],
    comments: [],
  }
  // 일상 소식에는 알림을 만들지 않는다. (기획서: 모든 소식에 알림을 보내지 않음)
  return { ok: true, state: { ...s, posts: [post, ...s.posts] }, id: post.id }
}

export function deletePost(s: FamilyState, postId: string): Outcome {
  const post = postOf(s, postId)
  if (!post) return reject('게시물을 찾을 수 없어요.')
  if (post.authorId !== s.currentUserId) return reject('내가 올린 글만 지울 수 있어요.')
  const linkedReq = requestOf(s, post.linkedRequestId)
  const linkedPlan = scheduleOf(s, post.linkedScheduleId)
  if ((linkedReq && isRequestActive(linkedReq)) || (linkedPlan && !linkedPlan.canceled && !linkedPlan.confirmed)) {
    return reject('진행 중인 부탁·일정이 연결된 글이에요. 먼저 마무리하거나 취소해 주세요.')
  }
  return { ok: true, state: { ...s, posts: s.posts.filter((p) => p.id !== postId) } }
}

export function markPostRead(s: FamilyState, postId: string): Outcome {
  const post = postOf(s, postId)
  if (!post || post.readBy.includes(s.currentUserId)) return { ok: true, state: s }
  return {
    ok: true,
    state: { ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, readBy: [...p.readBy, s.currentUserId] } : p)) },
  }
}

export function addComment(s: FamilyState, ctx: Ctx, postId: string, text: string): Outcome {
  const t = text.trim()
  if (!t) return reject('댓글을 입력해 주세요.')
  const post = postOf(s, postId)
  if (!post) return reject('게시물을 찾을 수 없어요.')
  const comment = { id: ctx.newId('c'), authorId: s.currentUserId, text: t, createdAt: ctx.now() }
  return {
    ok: true,
    id: comment.id,
    state: {
      ...s,
      posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)),
      notifications: [
        ...s.notifications,
        ...notify(s, ctx, [post.authorId], `${myName(s)}님이 댓글을 남겼어요: ${t.slice(0, 30)}`, { kind: 'post', id: postId }),
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// 부탁
// ---------------------------------------------------------------------------

export interface RequestDraft {
  sourcePostId?: string
  title: string
  detail?: string
  dueDate?: string
  audienceIds: string[]
  purchase?: PurchaseSpec
}

/** 원글을 일정·부탁으로 연결할 수 있는지 (글쓴이만, 한 번만) */
function checkSource(s: FamilyState, sourcePostId: string | undefined, what: string): Post | undefined | string {
  if (!sourcePostId) return undefined
  const source = postOf(s, sourcePostId)
  if (!source) return '원글을 찾을 수 없어요.'
  if (source.authorId !== s.currentUserId) return `내가 올린 글만 ${what}으로 연결할 수 있어요.`
  if (source.linkedRequestId || source.linkedScheduleId) return '이미 일정이나 부탁이 연결된 글이에요.'
  return source
}

export function createRequest(s: FamilyState, ctx: Ctx, d: RequestDraft): Outcome {
  if (!d.title.trim()) return reject('무엇을 부탁하는지 적어 주세요.')
  const audience = d.audienceIds.filter((id) => id !== s.currentUserId)
  if (audience.length === 0) return reject('부탁을 공유할 가족을 한 명 이상 골라 주세요.')
  if (d.purchase && !(d.purchase.quantity >= 1)) return reject('수량은 1개 이상이어야 해요.')
  // 부탁 여부는 글쓴이가 직접 선택한다. 다른 사람이 남의 글을 부탁으로 바꾸지 않는다.
  const source = checkSource(s, d.sourcePostId, '부탁')
  if (typeof source === 'string') return reject(source)

  const request: FamilyRequest = {
    id: ctx.newId('r'),
    sourcePostId: source?.id,
    requesterId: s.currentUserId,
    title: d.title.trim(),
    detail: (d.detail ?? '').trim(),
    dueDate: d.dueDate || undefined,
    audienceIds: audience,
    purchase: d.purchase ? { spec: d.purchase.spec.trim(), quantity: d.purchase.quantity } : undefined,
    status: 'OPEN',
    seenBy: [s.currentUserId],
    history: [entry(s, ctx, '부탁을 등록했어요')],
    createdAt: ctx.now(),
  }
  return {
    ok: true,
    id: request.id,
    state: {
      ...s,
      requests: [request, ...s.requests],
      posts: s.posts.map((p) => (p.id === source?.id ? { ...p, linkedRequestId: request.id } : p)),
      notifications: [
        ...s.notifications,
        ...notify(s, ctx, audience, `${myName(s)}님의 부탁: ${request.title}`, { kind: 'request', id: request.id }),
      ],
    },
  }
}

export function markRequestSeen(s: FamilyState, id: string): Outcome {
  const r = requestOf(s, id)
  if (!r || r.seenBy.includes(s.currentUserId)) return { ok: true, state: s }
  return withRequest(s, id, (x) => ({ ...x, seenBy: [...x.seenBy, s.currentUserId] }))
}

export function claimRequest(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const me = s.currentUserId
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.requesterId === me) return reject('내가 한 부탁은 직접 맡을 수 없어요.')
  if (!r.audienceIds.includes(me)) return reject('나에게 공유된 부탁이 아니에요.')
  // 중복 수락 방지: 이미 다른 사람이 맡았으면 현재 담당자를 알려 준다.
  if (r.assigneeId && r.assigneeId !== me) return reject(`${nameOf(s, r.assigneeId)}님이 이미 맡았어요.`)
  if (r.status !== 'OPEN') return reject(`지금은 맡을 수 없는 상태예요. (${requestStatusLabel(r)})`)
  return withRequest(
    s,
    id,
    (x) => ({ ...x, assigneeId: me, status: 'CLAIMED', history: [...x.history, entry(s, ctx, '제가 챙길게요')] }),
    (x) => notify(s, ctx, [x.requesterId], `${myName(s)}님이 '${x.title}'을(를) 맡았어요`, { kind: 'request', id }),
  )
}

export function releaseRequest(s: FamilyState, ctx: Ctx, id: string, reason: string): Outcome {
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.assigneeId !== s.currentUserId) return reject('내가 맡은 부탁만 맡기를 취소할 수 있어요.')
  if (r.status !== 'CLAIMED' && r.status !== 'IN_PROGRESS') return reject('지금은 맡기를 취소할 수 없어요.')
  const why = reason.trim() || '사유 없음'
  return withRequest(
    s,
    id,
    (x) => ({ ...x, assigneeId: undefined, status: 'OPEN', history: [...x.history, entry(s, ctx, `맡기 취소 · ${why}`)] }),
    (x) =>
      notify(s, ctx, [x.requesterId], `${myName(s)}님이 '${x.title}' 맡기를 취소했어요 (${why}). 다시 담당 없음 상태예요.`, {
        kind: 'request',
        id,
      }),
  )
}

export function markInProgress(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.assigneeId !== s.currentUserId) return reject('담당자만 진행 상태를 바꿀 수 있어요.')
  if (r.status !== 'CLAIMED') return reject('지금은 진행 상태로 바꿀 수 없어요.')
  const label = r.purchase ? '주문했어요' : '진행 중이에요'
  return withRequest(
    s,
    id,
    (x) => ({ ...x, status: 'IN_PROGRESS', history: [...x.history, entry(s, ctx, label)] }),
    (x) => notify(s, ctx, [x.requesterId], `'${x.title}' · ${myName(s)}님: ${label}`, { kind: 'request', id }),
  )
}

export function markDone(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const me = s.currentUserId
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.purchase) {
    // 주문과 수령을 구분한다. 받기 전에는 완료 처리하지 않으며, 받은 사람(요청자)이 확인한다.
    if (r.requesterId !== me) return reject("구매 부탁은 물건을 받은 요청자가 '받았어요'로 완료해요.")
    if (r.status !== 'IN_PROGRESS') return reject('주문 후에 받았어요를 누를 수 있어요.')
  } else {
    if (r.requesterId !== me && r.assigneeId !== me) return reject('요청자나 담당자만 완료할 수 있어요.')
    if (r.status !== 'CLAIMED' && r.status !== 'IN_PROGRESS') return reject('맡은 사람이 있어야 완료할 수 있어요.')
  }
  const label = r.purchase ? '받았어요' : '완료했어요'
  return withRequest(
    s,
    id,
    (x) => ({ ...x, status: 'DONE', history: [...x.history, entry(s, ctx, label)] }),
    (x) => notify(s, ctx, [x.requesterId, x.assigneeId], `'${x.title}' · ${myName(s)}님: ${label}`, { kind: 'request', id }),
  )
}

export function cancelRequest(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.requesterId !== s.currentUserId) return reject('부탁한 사람만 취소할 수 있어요.')
  if (!isRequestActive(r)) return reject('이미 끝난 부탁이에요.')
  return withRequest(
    s,
    id,
    (x) => ({ ...x, status: 'CANCELED', history: [...x.history, entry(s, ctx, '부탁을 취소했어요')] }),
    (x) => notify(s, ctx, [x.assigneeId], `'${x.title}' 부탁이 취소됐어요`, { kind: 'request', id }),
  )
}

export function updateRequest(
  s: FamilyState,
  ctx: Ctx,
  id: string,
  patch: { detail: string; dueDate?: string; purchase?: PurchaseSpec },
): Outcome {
  const r = requestOf(s, id)
  if (!r) return reject('부탁을 찾을 수 없어요.')
  if (r.requesterId !== s.currentUserId) return reject('부탁한 사람만 내용을 바꿀 수 있어요.')
  if (!isRequestActive(r)) return reject('이미 끝난 부탁은 바꿀 수 없어요.')
  if (r.purchase && !patch.purchase) return reject('구매 정보를 비울 수 없어요.')
  if (patch.purchase && !(patch.purchase.quantity >= 1)) return reject('수량은 1개 이상이어야 해요.')
  return withRequest(
    s,
    id,
    (x) => ({
      ...x,
      detail: patch.detail.trim(),
      dueDate: patch.dueDate || undefined,
      purchase: x.purchase ? patch.purchase : undefined,
      history: [...x.history, entry(s, ctx, '내용을 바꿨어요')],
    }),
    // 통화로 바뀐 내용이 자동 반영된다고 가정하지 않는다. 원래 항목을 고치면 담당자에게 알린다.
    (x) => notify(s, ctx, [x.assigneeId], `'${x.title}' 내용이 바뀌었어요. 확인해 주세요.`, { kind: 'request', id }),
  )
}

// ---------------------------------------------------------------------------
// 일정
// ---------------------------------------------------------------------------

export interface ScheduleDraft {
  sourcePostId?: string
  title: string
  startAt: string
  place?: string
  audienceIds: string[]
}

export function createSchedule(s: FamilyState, ctx: Ctx, d: ScheduleDraft): Outcome {
  if (!d.title.trim()) return reject('일정 이름을 적어 주세요.')
  if (!d.startAt) return reject('날짜와 시간을 골라 주세요.')
  const audience = d.audienceIds.filter((id) => id !== s.currentUserId)
  if (audience.length === 0) return reject('응답을 요청할 가족을 한 명 이상 골라 주세요.')
  const source = checkSource(s, d.sourcePostId, '일정')
  if (typeof source === 'string') return reject(source)

  const plan: SchedulePlan = {
    id: ctx.newId('s'),
    sourcePostId: source?.id,
    proposerId: s.currentUserId,
    title: d.title.trim(),
    startAt: d.startAt,
    place: d.place?.trim() || undefined,
    audienceIds: audience,
    responses: {},
    version: 1,
    confirmed: false,
    canceled: false,
    history: [entry(s, ctx, `일정을 제안했어요 · ${formatDateTime(d.startAt)}`)],
    createdAt: ctx.now(),
  }
  return {
    ok: true,
    id: plan.id,
    state: {
      ...s,
      schedules: [plan, ...s.schedules],
      posts: s.posts.map((p) => (p.id === source?.id ? { ...p, linkedScheduleId: plan.id } : p)),
      notifications: [
        ...s.notifications,
        ...notify(s, ctx, audience, `${myName(s)}님의 일정 제안: ${plan.title}`, { kind: 'schedule', id: plan.id }),
      ],
    },
  }
}

export function respondSchedule(s: FamilyState, ctx: Ctx, id: string, availability: Availability, note?: string): Outcome {
  const me = s.currentUserId
  const p = scheduleOf(s, id)
  if (!p) return reject('일정을 찾을 수 없어요.')
  if (p.canceled) return reject('취소된 일정이에요.')
  if (!p.audienceIds.includes(me)) return reject('응답을 요청받은 일정이 아니에요.')
  const label = AVAILABILITY_LABEL[availability]
  return withSchedule(
    s,
    id,
    (x) => ({
      ...x,
      responses: { ...x.responses, [me]: { memberId: me, availability, note: note?.trim() || undefined, version: x.version, at: ctx.now() } },
      history: [...x.history, entry(s, ctx, label)],
    }),
    (x) => notify(s, ctx, [x.proposerId], `'${x.title}' · ${myName(s)}님: ${label}`, { kind: 'schedule', id }),
  )
}

export function rescheduleSchedule(s: FamilyState, ctx: Ctx, id: string, startAt: string): Outcome {
  const p = scheduleOf(s, id)
  if (!p) return reject('일정을 찾을 수 없어요.')
  if (p.proposerId !== s.currentUserId) return reject('제안한 사람만 시간을 바꿀 수 있어요.')
  if (p.canceled) return reject('취소된 일정이에요.')
  if (!startAt) return reject('날짜와 시간을 골라 주세요.')
  if (startAt === p.startAt) return reject('기존과 같은 시간이에요.')
  return withSchedule(
    s,
    id,
    // 시간이 바뀌면 기존 '가능해요' 응답을 그대로 재사용하지 않고 재확인 대상으로 둔다.
    (x) => ({
      ...x,
      startAt,
      version: x.version + 1,
      confirmed: false,
      history: [...x.history, entry(s, ctx, `시간을 바꿨어요 → ${formatDateTime(startAt)}`)],
    }),
    (x) => notify(s, ctx, x.audienceIds, `'${x.title}' 시간이 바뀌었어요. 다시 응답해 주세요.`, { kind: 'schedule', id }),
  )
}

export function confirmSchedule(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const p = scheduleOf(s, id)
  if (!p) return reject('일정을 찾을 수 없어요.')
  if (p.proposerId !== s.currentUserId) return reject('제안한 사람이 일정을 확정해요.')
  if (p.canceled) return reject('취소된 일정이에요.')
  if (p.confirmed) return reject('이미 확정된 일정이에요.')
  return withSchedule(
    s,
    id,
    (x) => ({ ...x, confirmed: true, history: [...x.history, entry(s, ctx, '일정을 확정했어요')] }),
    (x) => notify(s, ctx, x.audienceIds, `'${x.title}' 일정이 확정됐어요 · ${formatDateTime(x.startAt)}`, { kind: 'schedule', id }),
  )
}

export function cancelSchedule(s: FamilyState, ctx: Ctx, id: string): Outcome {
  const p = scheduleOf(s, id)
  if (!p) return reject('일정을 찾을 수 없어요.')
  if (p.proposerId !== s.currentUserId) return reject('제안한 사람만 취소할 수 있어요.')
  if (p.canceled) return reject('이미 취소된 일정이에요.')
  return withSchedule(
    s,
    id,
    (x) => ({ ...x, canceled: true, confirmed: false, history: [...x.history, entry(s, ctx, '일정을 취소했어요')] }),
    (x) => notify(s, ctx, x.audienceIds, `'${x.title}' 일정이 취소됐어요`, { kind: 'schedule', id }),
  )
}

// ---------------------------------------------------------------------------
// 안부 질문
// ---------------------------------------------------------------------------

export interface QuestionDraft {
  text: string
  options: string[]
  targetIds: string[]
}

export function askQuestion(s: FamilyState, ctx: Ctx, d: QuestionDraft): Outcome {
  const text = d.text.trim()
  if (!text) return reject('무엇을 물어볼지 적어 주세요.')
  const options = [...new Set(d.options.map((o) => o.trim()).filter(Boolean))]
  if (options.length < 2 || options.length > 3) return reject('답 버튼은 2~3개로 만들어 주세요.')
  const targets = d.targetIds.filter((id) => id !== s.currentUserId && s.members.some((m) => m.id === id))
  if (targets.length === 0) return reject('물어볼 가족을 골라 주세요.')
  const q: FamilyQuestion = { id: ctx.newId('q'), askerId: s.currentUserId, targetIds: targets, text, options, answers: {}, createdAt: ctx.now() }
  return {
    ok: true,
    id: q.id,
    state: {
      ...s,
      questions: [q, ...s.questions],
      notifications: [...s.notifications, ...notify(s, ctx, targets, `${myName(s)}님이 물어봐요: ${text}`, { kind: 'question', id: q.id })],
    },
  }
}

export function answerQuestion(s: FamilyState, ctx: Ctx, id: string, option: string): Outcome {
  const me = s.currentUserId
  const q = questionOf(s, id)
  if (!q) return reject('질문을 찾을 수 없어요.')
  if (!q.targetIds.includes(me)) return reject('나에게 온 질문이 아니에요.')
  if (!q.options.includes(option)) return reject('보기 중에서 골라 주세요.')
  const updated: FamilyQuestion = { ...q, answers: { ...q.answers, [me]: { option, at: ctx.now() } } }
  return {
    ok: true,
    state: {
      ...s,
      questions: s.questions.map((x) => (x.id === id ? updated : x)),
      notifications: [...s.notifications, ...notify(s, ctx, [q.askerId], `${myName(s)}: "${option}" (${q.text})`, { kind: 'question', id })],
    },
  }
}

// ---------------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------------

export function markMyNotificationsRead(s: FamilyState): Outcome {
  if (!s.notifications.some((n) => n.recipientId === s.currentUserId && !n.read)) return { ok: true, state: s }
  return {
    ok: true,
    state: { ...s, notifications: s.notifications.map((n) => (n.recipientId === s.currentUserId ? { ...n, read: true } : n)) },
  }
}
