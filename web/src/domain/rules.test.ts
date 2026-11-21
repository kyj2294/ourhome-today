import { beforeEach, describe, expect, it } from 'vitest'
import { currentResponse, needsReconfirm, otherMemberIds, requestStatusLabel, type FamilyState } from './models'
import * as R from './rules'
import { DAD, JIEUN, MINSU, MOM, sampleState } from './sample'
import { togetherItems } from './together'

const NOW = new Date(2026, 10, 18, 9, 0) // 2026-11-18 (수) 09:00
let seq = 0
const ctx: R.Ctx = { now: () => NOW.toISOString(), newId: (p) => `${p}${++seq}` }

let s: FamilyState

/** 성공한 결과의 상태를 반영하고 결과를 돌려준다. */
function run(o: R.Outcome): R.Outcome {
  if (o.ok) s = o.state
  return o
}
const as = (id: string) => run(R.switchUser(s, id))
const idOf = (o: R.Outcome) => (o.ok ? o.id! : (() => { throw new Error(o.message) })())
const req = (id: string) => s.requests.find((r) => r.id === id)!
const plan = (id: string) => s.schedules.find((p) => p.id === id)!

beforeEach(() => {
  s = sampleState(NOW)
})

describe('가족 소식', () => {
  it('일상 게시는 알림을 만들지 않는다', () => {
    as(MOM)
    run(R.createPost(s, ctx, '오늘 점심은 칼국수', []))
    expect(s.notifications).toHaveLength(0)
    expect(s.posts[0].text).toBe('오늘 점심은 칼국수')
  })

  it('진행 중인 부탁이 연결된 글은 지울 수 없다', () => {
    as(MOM)
    expect(R.deletePost(s, 'p2').ok).toBe(false)
    expect(run(R.deletePost(s, 'p1')).ok).toBe(true)
  })
})

describe('부탁 — 정수기 필터 흐름', () => {
  it('게시 → 부탁 연결 → 자발적 수락 → 주문 → 수령', () => {
    as(MOM)
    const postId = idOf(run(R.createPost(s, ctx, '물맛이 달라졌네', ['sample:필터'])))
    const requestId = idOf(
      run(R.createRequest(s, ctx, { sourcePostId: postId, title: '정수기 필터 주문', audienceIds: otherMemberIds(s), purchase: { spec: '호환 필터', quantity: 2 } })),
    )
    expect(s.posts.find((p) => p.id === postId)!.linkedRequestId).toBe(requestId)
    expect(req(requestId).status).toBe('OPEN')
    expect(req(requestId).assigneeId).toBeUndefined()

    as(MINSU)
    expect(run(R.claimRequest(s, ctx, requestId)).ok).toBe(true)
    expect(req(requestId).assigneeId).toBe(MINSU)

    // 다른 가족이 다시 맡으려 하면 현재 담당을 알려 준다
    as(JIEUN)
    const dup = R.claimRequest(s, ctx, requestId)
    expect(dup.ok).toBe(false)
    expect(!dup.ok && dup.message).toContain('민수')

    as(MINSU)
    expect(run(R.markInProgress(s, ctx, requestId)).ok).toBe(true)
    expect(requestStatusLabel(req(requestId))).toBe('주문했어요')
    // 담당자는 '받았어요'로 완료할 수 없다 (주문과 수령 구분)
    expect(R.markDone(s, ctx, requestId).ok).toBe(false)

    as(MOM)
    expect(run(R.markDone(s, ctx, requestId)).ok).toBe(true)
    expect(requestStatusLabel(req(requestId))).toBe('받았어요')
  })

  it('남의 글은 부탁으로 바꿀 수 없다', () => {
    as(MINSU)
    expect(R.createRequest(s, ctx, { sourcePostId: 'p1', title: '화분 사기', audienceIds: [MOM] }).ok).toBe(false)
  })

  it('맡기 취소하면 담당 없음으로 돌아가고 요청자에게 알린다', () => {
    as(MINSU)
    run(R.claimRequest(s, ctx, 'r1'))
    run(R.releaseRequest(s, ctx, 'r1', '이번 주 출장'))
    expect(req('r1').status).toBe('OPEN')
    expect(req('r1').assigneeId).toBeUndefined()
    expect(s.notifications.some((n) => n.recipientId === MOM && n.message.includes('이번 주 출장'))).toBe(true)
  })

  it('내용을 바꾸면 담당자에게만 알린다', () => {
    as(MINSU)
    run(R.claimRequest(s, ctx, 'r1'))
    as(MOM)
    const before = s.notifications.length
    run(R.updateRequest(s, ctx, 'r1', { detail: '2개로 바꿀게', purchase: { spec: '호환 필터', quantity: 2 } }))
    const added = s.notifications.slice(before)
    expect(added.map((n) => n.recipientId)).toEqual([MINSU])
  })
})

describe('일정', () => {
  it('시간이 바뀌면 기존 응답은 재확인 대상이 된다', () => {
    as(MINSU)
    expect(currentResponse(plan('s1'), MOM)?.availability).toBe('AVAILABLE')
    run(R.rescheduleSchedule(s, ctx, 's1', plan('s1').startAt.replace('10:00', '14:00')))
    expect(currentResponse(plan('s1'), MOM)).toBeUndefined()
    expect(needsReconfirm(plan('s1'), MOM)).toBe(true)

    as(MOM)
    run(R.respondSchedule(s, ctx, 's1', 'AVAILABLE'))
    expect(needsReconfirm(plan('s1'), MOM)).toBe(false)
  })

  it('제안자만 일정을 확정한다', () => {
    as(MOM)
    expect(R.confirmSchedule(s, ctx, 's1').ok).toBe(false)
    as(MINSU)
    expect(run(R.confirmSchedule(s, ctx, 's1')).ok).toBe(true)
    expect(plan('s1').confirmed).toBe(true)
  })

  it('일정 생성은 응답 요청 대상에게만 알린다', () => {
    as(MOM)
    run(R.createSchedule(s, ctx, { title: '아빠 생신 저녁', startAt: '2026-11-28T18:00', audienceIds: [MINSU] }))
    expect(s.notifications.map((n) => n.recipientId)).toEqual([MINSU])
  })
})

describe('오늘 함께할 일', () => {
  it('응답 대기는 내가 응답할 항목만 보여준다', () => {
    as(DAD)
    const dad = togetherItems(s, 'AWAITING', '2026-11-18')
    expect(dad.some((i) => i.kind === 'request' && i.request.id === 'r1')).toBe(true)
    expect(dad.some((i) => i.kind === 'schedule')).toBe(false) // 이미 응답함

    as(JIEUN)
    const jieun = togetherItems(s, 'AWAITING', '2026-11-18')
    expect(jieun.some((i) => i.kind === 'schedule' && i.plan.id === 's1')).toBe(true)
  })
})

describe('안부 질문', () => {
  it('자녀가 묻고 부모님이 버튼으로 답하면 자녀에게 알린다', () => {
    as(MINSU)
    const id = idOf(run(R.askQuestion(s, ctx, { text: '약 드셨어요?', options: ['먹었어요', '아직이요', '이따 먹을게요'], targetIds: [MOM] })))
    expect(s.notifications[s.notifications.length - 1]).toMatchObject({ recipientId: MOM, target: { kind: 'question', id } })
    as(MOM)
    expect(run(R.answerQuestion(s, ctx, id, '먹었어요')).ok).toBe(true)
    expect(s.questions.find((q) => q.id === id)!.answers[MOM].option).toBe('먹었어요')
    expect(s.notifications[s.notifications.length - 1]).toMatchObject({ recipientId: MINSU, message: '엄마: "먹었어요" (약 드셨어요?)' })
    // 답을 바꿀 수 있다
    expect(run(R.answerQuestion(s, ctx, id, '아직이요')).ok).toBe(true)
  })

  it('답 버튼은 2~3개, 질문받은 사람만 답한다', () => {
    as(MINSU)
    expect(R.askQuestion(s, ctx, { text: '약?', options: ['네'], targetIds: [MOM] }).ok).toBe(false)
    expect(R.askQuestion(s, ctx, { text: '약?', options: ['1', '2', '3', '4'], targetIds: [MOM] }).ok).toBe(false)
    as(JIEUN)
    expect(R.answerQuestion(s, ctx, 'q1', '먹었어요').ok).toBe(false)
  })
})

describe('자동 안부', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)
  const make = () => {
    as(MINSU)
    return idOf(run(R.createRoutine(s, ctx, { text: '식사하셨어요?', options: ['먹었어요', '아직이요'], targetIds: [MOM], days: [1, 2, 3, 4, 5], times: ['12:30', '18:00'] })))
  }

  it('가장 최근 예정 회차를 계산한다 (평일 12:30, 18:00)', () => {
    const id = make()
    const r = s.routines.find((x) => x.id === id)!
    expect(R.latestOccurrence(r, at(18, 13))).toEqual(at(18, 12, 30)) // 수 13시 → 수 12:30
    expect(R.latestOccurrence(r, at(18, 9))).toEqual(at(17, 18)) // 수 9시 → 화 18:00
    expect(R.latestOccurrence(r, at(22, 10))).toEqual(at(20, 18)) // 일요일 → 금 18:00
  })

  it('시간이 되면 한 번만 보내고, 밀린 회차는 가장 최근 1번만 보낸다', () => {
    const id = make() // 18일(수) 09:00에 만듦
    const fire = (d: Date) => run(R.fireDueRoutines(s, ctx, d))
    fire(at(18, 12, 0))
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(0) // 아직 시간 전
    fire(at(18, 12, 31))
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(1)
    fire(at(18, 12, 45))
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(1) // 같은 회차는 다시 안 보냄
    fire(at(20, 19, 0)) // 이틀 동안 안 열다가 금요일 저녁에 열면
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(2) // 1번만 더
    const q = s.questions.find((x) => x.routineId === id)!
    expect(q).toMatchObject({ askerId: MINSU, targetIds: [MOM], text: '식사하셨어요?' })
  })

  it('꺼 두면 보내지 않고, 다시 켜도 밀린 회차는 보내지 않는다', () => {
    const id = make()
    run(R.setRoutineEnabled(s, ctx, id, false))
    run(R.fireDueRoutines(s, ctx, at(18, 13)))
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(0)
  })

  it('요일·시간이 없거나 남의 자동 안부는 거절한다', () => {
    as(MINSU)
    expect(R.createRoutine(s, ctx, { text: '약?', options: ['네', '아니요'], targetIds: [MOM], days: [], times: ['08:00'] }).ok).toBe(false)
    expect(R.createRoutine(s, ctx, { text: '약?', options: ['네', '아니요'], targetIds: [MOM], days: [1], times: [] }).ok).toBe(false)
    expect(R.deleteRoutine(s, 'rt1').ok).toBe(false) // 지은이 만든 것
  })
})

describe('자동화 — 알림·수정', () => {
  it('답이 필요 없는 알림은 "알겠어요" 버튼 하나로 보낸다', () => {
    as(MINSU)
    const id = idOf(run(R.createRoutine(s, ctx, { text: '💧 물 드실 시간이에요', options: [], reminder: true, targetIds: [MOM], days: [0, 1, 2, 3, 4, 5, 6], times: ['15:00'] })))
    run(R.fireDueRoutines(s, ctx, new Date(2026, 10, 18, 15, 1)))
    const q = s.questions.find((x) => x.routineId === id)!
    expect(q).toMatchObject({ reminder: true, options: ['알겠어요 👍'] })
    expect(s.notifications[s.notifications.length - 1].message).toBe('민수님의 알림: 💧 물 드실 시간이에요')
  })

  it('만든 사람은 시간·내용을 고칠 수 있고, 고친 뒤 이전 회차는 보내지 않는다', () => {
    as(MINSU)
    const id = idOf(run(R.createRoutine(s, ctx, { text: '약 드셨어요?', options: ['네', '아니요'], targetIds: [MOM], days: [3], times: ['08:00'] })))
    expect(run(R.updateRoutine(s, ctx, id, { text: '혈압약 드셨어요?', options: ['먹었어요', '아직이요'], targetIds: [MOM, DAD], days: [1, 3], times: ['08:30', '20:00'] })).ok).toBe(true)
    expect(s.routines.find((r) => r.id === id)).toMatchObject({ text: '혈압약 드셨어요?', targetIds: [MOM, DAD], days: [1, 3], times: ['08:30', '20:00'] })
    run(R.fireDueRoutines(s, ctx, new Date(2026, 10, 18, 9, 0))) // 고친 시각(09:00) 이전 회차(08:30)는 안 보냄
    expect(s.questions.filter((q) => q.routineId === id)).toHaveLength(0)
    as(JIEUN)
    expect(R.updateRoutine(s, ctx, id, { text: 'x', options: ['a', 'b'], targetIds: [MOM], days: [1], times: ['08:00'] }).ok).toBe(false)
  })
})

describe('카드', () => {
  it('카드와 메시지를 담아 보낼 수 있다', () => {
    as(MINSU)
    const id = idOf(run(R.askQuestion(s, ctx, { text: '사랑해요', options: ['고마워 ❤️', '나도 사랑해 😊'], targetIds: [MOM], card: 'love', message: '엄마 사랑해요' })))
    expect(s.questions.find((q) => q.id === id)).toMatchObject({ card: 'love', message: '엄마 사랑해요' })
    expect(s.notifications[s.notifications.length - 1].message).toBe('민수님이 카드를 보냈어요: 사랑해요')
  })
})

describe('구성원', () => {
  it('전화번호를 등록하고 잘못된 번호는 거절한다', () => {
    expect(run(R.setMemberPhone(s, MOM, '010-1234-5678')).ok).toBe(true)
    expect(s.members.find((m) => m.id === MOM)!.phone).toBe('010-1234-5678')
    expect(R.setMemberPhone(s, MOM, '12').ok).toBe(false)
  })

  it('샘플 가족은 부모님 2명, 자녀 2명이다', () => {
    expect(s.members.filter((m) => m.role === 'parent').map((m) => m.name)).toEqual(['엄마', '아빠'])
    expect(s.members.filter((m) => m.role === 'child').map((m) => m.name)).toEqual(['민수', '지은'])
  })

  it('가족을 추가할 수 있고 같은 이름은 거절한다', () => {
    expect(run(R.addMember(s, ctx, '할머니', '외할머니', 'parent')).ok).toBe(true)
    expect(s.members).toHaveLength(5)
    expect(s.members[4].role).toBe('parent')
    expect(R.addMember(s, ctx, '할머니', '', 'parent').ok).toBe(false)
  })
})
