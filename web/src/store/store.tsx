import { del, get, set } from 'idb-keyval'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FamilyState } from '../domain/models'
import { type Ctx, type Outcome, fireDueRoutines } from '../domain/rules'
import { SCHEMA_VERSION, sampleState } from '../domain/sample'

/**
 * 앱 상태 저장소 (프로토타입)
 *
 * - 데이터는 이 브라우저의 IndexedDB에 저장된다. 새로고침해도 유지되지만, 다른 기기와는 공유되지 않는다.
 * - "이 기기를 쓰는 사람"은 처음 화면에서 고르고 localStorage에 기억한다.
 *   탭마다 다른 사람으로 바꿀 수도 있다(sessionStorage) → 탭 두 개를 엄마·민수로 열면 실시간 동기화된다.
 * - 서버를 붙일 때는 이 파일만 바꾸면 된다. 규칙(domain/rules.ts)은 그대로 재사용한다.
 */

const DB_KEY = 'ourhome-today/state'
const TAB_USER_KEY = 'ourhome-today/current-user'
const DEVICE_USER_KEY = 'ourhome-today/device-user'
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
  /** 처음 화면에서 누구인지 골랐는지 */
  signedIn: boolean
  signIn: (memberId: string) => void
  /** 처음 화면(부모님/자녀 선택)으로 돌아간다 */
  signOut: () => void
}

const StoreContext = createContext<Store | null>(null)

function readKey(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key)
  } catch {
    return null
  }
}
function writeKey(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key)
    else store().setItem(key, value)
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}
const session = () => sessionStorage
const local = () => localStorage

/** 이 탭(없으면 이 기기)에서 고른 사람. 지워진 구성원이면 null */
function chosenUser(s: FamilyState): string | null {
  const id = readKey(session, TAB_USER_KEY) ?? readKey(local, DEVICE_USER_KEY)
  return id && s.members.some((m) => m.id === id) ? id : null
}

export function StoreProvider({ children, onToast }: { children: ReactNode; onToast: (m: string) => void }) {
  const [state, setState] = useState<FamilyState | null>(null)
  const ref = useRef<FamilyState | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const warnedSave = useRef(false)
  const [signedIn, setSignedIn] = useState(false)

  const commit = useCallback((next: FamilyState, broadcast = true) => {
    ref.current = next
    setState(next)
    set(DB_KEY, next).catch(() => {
      if (warnedSave.current) return
      warnedSave.current = true
      onToast('이 브라우저에서는 저장이 안 돼요. 새로고침하면 처음 상태로 돌아가요.')
    })
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
        const mine = chosenUser(base)
        const s = mine ? { ...base, currentUserId: mine } : base
        ref.current = s
        setState(s)
        setSignedIn(!!mine)
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

  // 자동 안부: 열 때, 30초마다, 다시 돌아왔을 때 시간이 된 것을 보낸다.
  // (실제 서비스에서는 서버가 정한 시각에 푸시로 보낸다)
  const loaded = state !== null
  useEffect(() => {
    if (!loaded) return
    const tick = () => {
      const current = ref.current
      if (!current) return
      const o = fireDueRoutines(current, ctx, new Date())
      if (o.ok && o.state !== current) commit(o.state, true)
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loaded, commit])

  const resetDemo = useCallback(async () => {
    await del(DB_KEY).catch(() => undefined)
    const fresh = sampleState()
    commit(fresh)
    onToast('샘플 데이터로 처음부터 다시 시작해요')
  }, [commit, onToast])

  const signIn = useCallback(
    (memberId: string) => {
      const current = ref.current
      if (!current || !current.members.some((m) => m.id === memberId)) return
      writeKey(session, TAB_USER_KEY, memberId)
      writeKey(local, DEVICE_USER_KEY, memberId)
      const next = { ...current, currentUserId: memberId }
      ref.current = next
      setState(next)
      setSignedIn(true)
    },
    [],
  )

  const signOut = useCallback(() => {
    writeKey(session, TAB_USER_KEY, null)
    writeKey(local, DEVICE_USER_KEY, null)
    setSignedIn(false)
  }, [])

  if (!state) {
    return <div className="splash">우리집 오늘</div>
  }
  return (
    <StoreContext.Provider value={{ state, run, toast: onToast, resetDemo, signedIn, signIn, signOut }}>{children}</StoreContext.Provider>
  )
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 쓸 수 없어요')
  return s
}
