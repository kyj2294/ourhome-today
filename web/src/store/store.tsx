import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FamilyState } from '../domain/models'
import { type Ctx, type Outcome, fireDueRoutines } from '../domain/rules'
import { SCHEMA_VERSION, sampleState } from '../domain/sample'
import { fetchFamily, logout as apiLogout, myMemberId, notifySaved, saveFamily, subscribeFamily, uploadPhoto } from '../remote/api'
import { type Pending, applyPending, makeReplayCtx } from '../remote/sync'

/**
 * 앱 상태 저장소 — Supabase에 가족 문서 하나를 두고 가족 모두가 함께 쓴다.
 *
 * - 로그인: 정해진 계정 4개 (엄마·아빠·민수·지은)
 * - 화면 상태 = 서버가 확인한 상태 + 아직 저장 안 된 내 행동들 (누르면 바로 반영되어 보인다)
 * - 저장은 버전 확인 후에만. 다른 기기가 먼저 저장했으면 최신 상태를 받아 내 행동을 다시 얹는다.
 * - 다른 기기의 변경은 실시간으로 받는다 (+30초마다, 앱으로 돌아올 때 한 번 더 확인)
 */

type Action = (s: FamilyState, ctx: Ctx) => Outcome

interface Store {
  state: FamilyState
  /** 규칙을 실행한다. 거절이면 사유를, 성공이면 success 문구를 토스트로 띄운다. */
  run: (action: Action, success?: string) => Outcome
  toast: (message: string) => void
  /** 가족 데이터를 샘플로 되돌린다 (모든 가족에게 적용) */
  resetDemo: () => Promise<void>
  /** 사진을 올리고 보기 링크를 받는다 */
  uploadImage: (dataUrl: string) => Promise<string>
  signOut: () => Promise<void>
  /** 아직 저장 중인 변경이 있는지 */
  saving: boolean
}

const StoreContext = createContext<Store | null>(null)

const isFamilyState = (s: unknown): s is FamilyState => !!s && typeof s === 'object' && (s as FamilyState).schema === SCHEMA_VERSION

export function StoreProvider({
  children,
  onToast,
  login,
}: {
  children: ReactNode
  onToast: (m: string) => void
  /** 로그인 화면. 로그인에 성공하면 onLogin(memberId)을 부른다. */
  login: (onLogin: (memberId: string) => Promise<void>) => ReactNode
}) {
  const [memberId, setMemberId] = useState<string | null | undefined>(undefined) // undefined = 확인 중
  const [view, setView] = useState<FamilyState | null>(null)
  const [saving, setSaving] = useState(false)
  const confirmed = useRef<{ state: FamilyState; version: number } | null>(null)
  const pending = useRef<Pending[]>([])
  const flushing = useRef(false)
  const me = useRef<string>('')

  const refresh = useCallback(() => {
    if (!confirmed.current) return
    setView(applyPending(confirmed.current.state, pending.current, me.current))
    setSaving(pending.current.length > 0)
  }, [])

  /** 서버에서 받은 상태 반영 (더 최신일 때만) */
  const receive = useCallback(
    (state: FamilyState, version: number) => {
      if (confirmed.current && version <= confirmed.current.version) return
      confirmed.current = { state, version }
      refresh()
    },
    [refresh],
  )

  /** 대기 중인 행동을 하나씩 저장 */
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      let conflicts = 0
      while (pending.current.length && confirmed.current) {
        const base = confirmed.current
        const next = applyPending(base.state, pending.current.slice(0, 1), me.current)
        try {
          const v = await saveFamily(next, base.version)
          if (v === null) {
            // 다른 기기가 먼저 저장 → 최신 상태를 받고 같은 행동을 다시 얹는다
            const row = await fetchFamily()
            if (isFamilyState(row.state)) confirmed.current = { state: row.state, version: row.version }
            refresh()
            if (++conflicts > 5) throw new Error('conflict')
            continue
          }
          confirmed.current = { state: next, version: v }
          pending.current = pending.current.slice(1)
          notifySaved(v)
          conflicts = 0
          refresh()
        } catch {
          onToast('저장하지 못했어요. 인터넷 연결을 확인해 주세요. 잠시 후 다시 시도해요.')
          window.setTimeout(() => void flush(), 5000)
          return
        }
      }
    } finally {
      flushing.current = false
    }
  }, [onToast, refresh])

  /** 로그인 후 가족 문서 불러오기 (비어 있으면 샘플 가족으로 시작) */
  const load = useCallback(
    async (id: string) => {
      me.current = id
      const row = await fetchFamily()
      if (isFamilyState(row.state)) {
        confirmed.current = { state: row.state, version: row.version }
      } else {
        const fresh = sampleState()
        const v = await saveFamily(fresh, row.version)
        const latest = v === null ? await fetchFamily() : { state: fresh, version: v }
        confirmed.current = { state: latest.state as FamilyState, version: latest.version }
      }
      pending.current = []
      refresh()
      setMemberId(id)
    },
    [refresh],
  )

  // 처음: 이미 로그인돼 있는지 확인
  useEffect(() => {
    myMemberId()
      .then((id) => (id ? load(id) : setMemberId(null)))
      .catch(() => setMemberId(null))
  }, [load])

  // 로그인 상태에서: 실시간 구독 + 주기 확인 + 자동 안부
  useEffect(() => {
    if (!memberId) return
    const pull = () =>
      fetchFamily()
        .then((row) => {
          if (isFamilyState(row.state)) receive(row.state, row.version)
        })
        .catch(() => undefined)
    const ch = subscribeFamily((row) => {
      if (isFamilyState(row.state)) receive(row.state, row.version)
    }, pull)
    const tick = () => {
      void pull()
      if (!confirmed.current) return
      const ctx = makeReplayCtx()
      const now = new Date()
      const o = fireDueRoutines(applyPending(confirmed.current.state, pending.current, me.current), ctx, now)
      if (o.ok && o.id !== '0') {
        pending.current = [...pending.current, { action: (s, c) => fireDueRoutines(s, c, now), ctx }]
        refresh()
        void flush()
      }
    }
    const first = window.setTimeout(tick, 1500)
    const timer = window.setInterval(tick, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void ch.unsubscribe()
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [memberId, receive, refresh, flush])

  const run = useCallback(
    (action: Action, success?: string): Outcome => {
      if (!confirmed.current) return { ok: false, message: '불러오는 중이에요.' }
      const ctx = makeReplayCtx()
      const current = applyPending(confirmed.current.state, pending.current, me.current)
      const outcome = action(current, ctx)
      if (outcome.ok) {
        if (outcome.state !== current) {
          pending.current = [...pending.current, { action, ctx }]
          refresh()
          void flush()
        }
        if (success) onToast(success)
      } else {
        onToast(outcome.message)
      }
      return outcome
    },
    [flush, onToast, refresh],
  )

  const resetDemo = useCallback(async () => {
    const fresh = sampleState()
    run(() => ({ ok: true, state: fresh }), '가족 데이터를 처음 상태로 되돌렸어요')
  }, [run])

  const uploadImage = useCallback((dataUrl: string) => uploadPhoto(dataUrl), [])

  const signOut = useCallback(async () => {
    await apiLogout()
    confirmed.current = null
    pending.current = []
    setView(null)
    setMemberId(null)
  }, [])

  if (memberId === undefined) return <div className="splash">우리집 오늘</div>
  if (memberId === null) return <>{login(load)}</>
  if (!view) return <div className="splash">불러오는 중…</div>
  return <StoreContext.Provider value={{ state: view, run, toast: onToast, resetDemo, uploadImage, signOut, saving }}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 쓸 수 없어요')
  return s
}
