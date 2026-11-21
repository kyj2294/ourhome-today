import { del, get, set } from 'idb-keyval'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FamilyState } from '../domain/models'
import type { Ctx, Outcome } from '../domain/rules'
import { SCHEMA_VERSION, sampleState } from '../domain/sample'

/**
 * 앱 상태 저장소 (프로토타입)
 *
 * - 데이터는 이 브라우저의 IndexedDB에 저장된다. 새로고침해도 유지되지만, 다른 기기와는 공유되지 않는다.
 * - "지금 사용 중인 가족"은 탭마다 따로 기억한다(sessionStorage).
 *   → 탭 두 개를 열어 한쪽은 엄마, 한쪽은 민수로 쓰면 BroadcastChannel로 실시간 동기화된다.
 * - 서버를 붙일 때는 이 파일만 바꾸면 된다. 규칙(domain/rules.ts)은 그대로 재사용한다.
 */

const DB_KEY = 'ourhome-today/state'
const TAB_USER_KEY = 'ourhome-today/current-user'
const CHANNEL = 'ourhome-today'

const ctx: Ctx = {
  now: () => new Date().toISOString(),
  newId: (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
}

type Action = (s: FamilyState, ctx: Ctx) => Outcome

interface Store {
  state: FamilyState
  /** 규칙을 실행한다. 거절이면 사유를, 성공이면 success 문구를 토스트로 띄운다. */
  run: (action: Action, success?: string) => Outcome
  toast: (message: string) => void
  resetDemo: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

function readTabUser(): string | null {
  try {
    return sessionStorage.getItem(TAB_USER_KEY)
  } catch {
    return null
  }
}
function writeTabUser(id: string) {
  try {
    sessionStorage.setItem(TAB_USER_KEY, id)
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

/** 탭별 사용자 설정을 반영한다. (없거나 지워진 구성원이면 저장된 값을 쓴다) */
function withTabUser(s: FamilyState): FamilyState {
  const mine = readTabUser()
  return mine && s.members.some((m) => m.id === mine) ? { ...s, currentUserId: mine } : s
}

export function StoreProvider({ children, onToast }: { children: ReactNode; onToast: (m: string) => void }) {
  const [state, setState] = useState<FamilyState | null>(null)
  const ref = useRef<FamilyState | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)

  const commit = useCallback((next: FamilyState, broadcast = true) => {
    ref.current = next
    setState(next)
    writeTabUser(next.currentUserId)
    set(DB_KEY, next).catch(() => onToast('저장 공간이 부족해 변경 사항을 저장하지 못했어요.'))
    if (broadcast) channel.current?.postMessage(next)
  }, [onToast])

  // 처음 불러오기 + 다른 탭과 동기화
  useEffect(() => {
    let alive = true
    get<FamilyState>(DB_KEY)
      .catch(() => undefined)
      .then((saved) => {
        if (!alive) return
        const base = saved && saved.schema === SCHEMA_VERSION ? saved : sampleState()
        const s = withTabUser(base)
        ref.current = s
        setState(s)
        if (!saved) set(DB_KEY, s).catch(() => undefined)
      })

    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL)
      bc.onmessage = (e: MessageEvent<FamilyState>) => {
        const mine = ref.current?.currentUserId
        const incoming = e.data
        const next = mine && incoming.members.some((m) => m.id === mine) ? { ...incoming, currentUserId: mine } : incoming
        ref.current = next
        setState(next)
      }
      channel.current = bc
    }
    return () => {
      alive = false
      channel.current?.close()
    }
  }, [])

  const run = useCallback(
    (action: Action, success?: string): Outcome => {
      const current = ref.current
      if (!current) return { ok: false, message: '불러오는 중이에요.' }
      const outcome = action(current, ctx)
      if (outcome.ok) {
        if (outcome.state !== current) commit(outcome.state, true)
        if (success) onToast(success)
      } else {
        onToast(outcome.message)
      }
      return outcome
    },
    [commit, onToast],
  )

  const resetDemo = useCallback(async () => {
    await del(DB_KEY).catch(() => undefined)
    const fresh = sampleState()
    commit(fresh)
    onToast('샘플 데이터로 처음부터 다시 시작해요')
  }, [commit, onToast])

  if (!state) {
    return <div className="splash">우리집 오늘</div>
  }
  return <StoreContext.Provider value={{ state, run, toast: onToast, resetDemo }}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 쓸 수 없어요')
  return s
}
