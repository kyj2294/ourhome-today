import { useEffect, useState } from 'react'
import { ROLE_LABEL } from '../../domain/models'
import { login } from '../../remote/api'
import { ACCOUNTS, DEMO_PIN } from '../../remote/config'

/**
 * 로그인: 내 얼굴(이름)을 누르고 비밀번호 4자리를 누르면 끝.
 * 프로토타입이라 계정은 엄마·아빠·민수·지은 4개뿐이다.
 */
export function LoginPage({ onLogin }: { onLogin: (memberId: string) => Promise<void> }) {
  const [who, setWho] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const acc = ACCOUNTS.find((a) => a.memberId === who)

  useEffect(() => {
    if (pin.length !== 4 || !who || busy) return
    setBusy(true)
    login(who, pin).then(async (err) => {
      if (err) {
        setError(err)
        setPin('')
        setBusy(false)
        return
      }
      await onLogin(who)
    })
  }, [pin, who, busy, onLogin])

  if (!acc) {
    return (
      <main className="onboarding login">
        <div className="onb-hero">
          <div className="onb-logo">🏠</div>
          <h1>우리집 오늘</h1>
          <p>따로 살아도, 오늘을 함께</p>
        </div>
        <h2 className="onb-question">누구세요?</h2>
        <div className="login-people">
          {ACCOUNTS.map((a) => (
            <button key={a.memberId} className="login-person" onClick={() => (setWho(a.memberId), setPin(''), setError(''))}>
              <span className="login-avatar" style={{ background: a.color }}>
                {a.name.slice(0, 1)}
              </span>
              <b>{a.name}</b>
              <span className="muted small">{ROLE_LABEL[a.role]}</span>
            </button>
          ))}
        </div>
      </main>
    )
  }

  const press = (d: string) => {
    setError('')
    setPin((p) => (p.length < 4 ? p + d : p))
  }
  return (
    <main className="onboarding login">
      <button className="onb-back" onClick={() => setWho(null)}>
        ← 다른 사람
      </button>
      <div className="pin-head">
        <span className="login-avatar big" style={{ background: acc.color }}>
          {acc.name.slice(0, 1)}
        </span>
        <h2>{acc.name}, 비밀번호 4자리를 눌러 주세요</h2>
      </div>
      <div className={`pin-dots ${error ? 'shake' : ''}`} aria-label={`${pin.length}자리 입력`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <p className="pin-msg">{busy ? '들어가는 중…' : error || `예시 비밀번호: ${DEMO_PIN}`}</p>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => press('0')} disabled={busy}>
          0
        </button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} aria-label="지우기">
          ⌫
        </button>
      </div>
    </main>
  )
}
