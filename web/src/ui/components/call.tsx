import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { josa } from '../../domain/korean'
import { memberOf } from '../../domain/models'
import { useStore } from '../../store/store'
import { Avatar } from './common'

/**
 * 바로 전화하기
 * - 버튼을 누르면 휴대폰 전화 앱으로 연결한다(tel: 링크).
 * - 통화를 마치고 앱으로 돌아오면(또는 '통화 끝났어요'를 누르면) 통화 정리 화면으로 간다.
 *   웹에서는 통화 음성을 들을 수 없으므로, 통화에서 정한 것을 말이나 글로 한 줄 남기게 한다.
 */
interface CallApi {
  startCall: (memberId: string) => void
}
const CallContext = createContext<CallApi | null>(null)

export function CallProvider({ children }: { children: ReactNode }) {
  const { state, toast } = useStore()
  const navigate = useNavigate()
  const [calling, setCalling] = useState<{ memberId: string; at: number } | null>(null)
  const callingRef = useRef(calling)
  callingRef.current = calling

  const finish = useCallback(() => {
    const c = callingRef.current
    if (!c) return
    setCalling(null)
    navigate(`/call/${c.memberId}`)
  }, [navigate])

  // 전화 앱에서 돌아오면 자동으로 정리 화면으로
  useEffect(() => {
    if (!calling) return
    const onBack = () => {
      if (document.visibilityState === 'visible' && Date.now() - calling.at > 4000) finish()
    }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [calling, finish])

  const startCall = useCallback(
    (memberId: string) => {
      const m = memberOf(state, memberId)
      if (!m) return
      if (!m.phone) {
        toast(`${josa(m.name, '은', '는')} 아직 전화번호가 없어요. '우리 가족'에서 등록해 주세요.`)
        return
      }
      setCalling({ memberId, at: Date.now() })
      const a = document.createElement('a')
      a.href = `tel:${m.phone.replace(/[^0-9+]/g, '')}`
      a.click()
    },
    [state, toast],
  )

  const m = calling ? memberOf(state, calling.memberId) : undefined
  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {calling && m && (
        <div className="call-overlay" role="dialog" aria-label="전화 거는 중">
          <div className="call-card">
            <Avatar member={m} size={88} />
            <div className="call-title">{m.name}에게 전화 거는 중</div>
            <div className="muted">{m.phone}</div>
            <p className="call-hint">통화가 끝나면 아래 버튼을 눌러 주세요.</p>
            <button className="btn btn-primary btn-xl" onClick={finish}>
              통화 끝났어요
            </button>
            <button className="btn btn-text" onClick={() => setCalling(null)}>
              전화 안 했어요
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  )
}

export function useCall(): CallApi {
  const c = useContext(CallContext)
  if (!c) throw new Error('CallProvider 밖에서 useCall을 쓸 수 없어요')
  return c
}

/** 전화 버튼 */
export function CallButton({ memberId, label, className = 'btn btn-outline' }: { memberId: string; label?: string; className?: string }) {
  const { startCall } = useCall()
  const { state } = useStore()
  const m = memberOf(state, memberId)
  return (
    <button className={className} onClick={() => startCall(memberId)} aria-label={`${m?.name ?? ''}에게 전화`}>
      📞 {label ?? '전화'}
    </button>
  )
}
