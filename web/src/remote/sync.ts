/**
 * 여러 기기가 같은 가족 문서를 고칠 때의 동기화 규칙 (순수 함수 — 테스트 가능)
 *
 * - 서버가 확인한 상태(confirmed) 위에, 아직 저장 안 된 행동(pending)을 차례로 다시 적용해 화면 상태를 만든다.
 * - 저장은 버전이 맞을 때만 성공한다. 다른 기기가 먼저 저장했으면 최신 상태를 받아 같은 행동을 다시 적용한다.
 * - 다시 적용해도 결과가 같도록, 행동마다 시각과 새 id를 처음 실행할 때 정해 두고 재사용한다.
 */
import type { FamilyState } from '../domain/models'
import type { Ctx, Outcome } from '../domain/rules'

export type Action = (s: FamilyState, ctx: Ctx) => Outcome

/** 다시 실행해도 같은 시각·같은 id를 돌려주는 컨텍스트 */
export interface ReplayCtx extends Ctx {
  reset(): void
}

export function makeReplayCtx(nowIso: string = new Date().toISOString(), rand: () => string = defaultRand): ReplayCtx {
  const ids: string[] = []
  let cursor = 0
  return {
    now: () => nowIso,
    newId(prefix: string) {
      if (cursor < ids.length) return ids[cursor++]
      const id = `${prefix}_${Date.parse(nowIso).toString(36)}${rand()}`
      ids.push(id)
      cursor++
      return id
    },
    reset() {
      cursor = 0
    },
  }
}

function defaultRand() {
  return Math.random().toString(36).slice(2, 7)
}

export interface Pending {
  action: Action
  ctx: ReplayCtx
}

/** 저장된 상태에서 내 입장(currentUserId)으로 보기 */
export const asMember = (s: FamilyState, memberId: string): FamilyState => (s.currentUserId === memberId ? s : { ...s, currentUserId: memberId })

/** 행동 하나를 다시 적용. 거절되면 상태를 그대로 둔다. */
export function replay(base: FamilyState, p: Pending, memberId: string): FamilyState {
  p.ctx.reset()
  const o = p.action(asMember(base, memberId), p.ctx)
  return o.ok ? o.state : asMember(base, memberId)
}

/** 화면에 보일 상태 = 확인된 상태 + 대기 중인 행동들 */
export function applyPending(confirmed: FamilyState, pending: Pending[], memberId: string): FamilyState {
  return pending.reduce((s, p) => replay(s, p, memberId), asMember(confirmed, memberId))
}
