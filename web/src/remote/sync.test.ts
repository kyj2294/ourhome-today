import { describe, expect, it } from 'vitest'
import * as R from '../domain/rules'
import { MINSU, MOM, sampleState } from '../domain/sample'
import { applyPending, makeReplayCtx, replay, type Pending } from './sync'

const NOW = new Date(2026, 10, 18, 9, 0)

describe('여러 기기 동기화', () => {
  it('같은 행동을 다시 적용해도 같은 id·시각이 나온다', () => {
    const base = sampleState(NOW)
    const p: Pending = { action: (s, c) => R.createPost(s, c, '안녕', []), ctx: makeReplayCtx(NOW.toISOString()) }
    const a = replay(base, p, MOM)
    const b = replay(base, p, MOM)
    expect(a.posts[0].id).toBe(b.posts[0].id)
    expect(a.posts[0].createdAt).toBe(NOW.toISOString())
    expect(a.posts[0].authorId).toBe(MOM)
  })

  it('다른 기기가 먼저 저장해도 내 행동을 최신 상태 위에 다시 얹는다', () => {
    const base = sampleState(NOW)
    // 엄마 기기: 사진 올리기 (아직 저장 전)
    const momPost: Pending = { action: (s, c) => R.createPost(s, c, '꽃 피었어요', ['url']), ctx: makeReplayCtx(NOW.toISOString()) }
    // 그 사이 민수 기기가 먼저 저장: 정수기 필터 맡기
    const minsuSaved = (() => {
      const o = R.claimRequest({ ...base, currentUserId: MINSU }, makeReplayCtx(NOW.toISOString()), 'r1')
      if (!o.ok) throw new Error(o.message)
      return o.state
    })()
    // 엄마 기기는 최신 상태를 받아 내 행동을 다시 적용
    const merged = applyPending(minsuSaved, [momPost], MOM)
    expect(merged.currentUserId).toBe(MOM)
    expect(merged.posts[0].text).toBe('꽃 피었어요')
    expect(merged.requests.find((r) => r.id === 'r1')!.assigneeId).toBe(MINSU) // 민수 변경도 살아 있음
  })

  it('최신 상태에서 거절되는 행동은 조용히 빠진다 (예: 이미 다른 사람이 맡음)', () => {
    const base = sampleState(NOW)
    const minsuClaimed = R.claimRequest({ ...base, currentUserId: MINSU }, makeReplayCtx(), 'r1')
    if (!minsuClaimed.ok) throw new Error()
    const jieunClaim: Pending = { action: (s, c) => R.claimRequest(s, c, 'r1'), ctx: makeReplayCtx() }
    const merged = applyPending(minsuClaimed.state, [jieunClaim], 'm_jieun')
    expect(merged.requests.find((r) => r.id === 'r1')!.assigneeId).toBe(MINSU)
  })
})
