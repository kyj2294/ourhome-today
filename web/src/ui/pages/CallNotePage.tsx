import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type CallSuggestion, extractFromCallNote } from '../../domain/callNotes'
import { formatDateTime } from '../../domain/dates'
import { demoCallScript, formatDuration } from '../../domain/demoCall'
import { josa } from '../../domain/korean'
import { memberOf, otherMemberIds } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { Avatar } from '../components/common'

/* 브라우저 음성 인식 (Chrome·Edge·Safari 일부 지원). 타입이 표준 lib에 없어 최소한으로 선언한다. */
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
function makeRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

type Item = CallSuggestion & { key: number; added?: boolean }

/**
 * 통화 정리
 * 1) 🤖 AI 통화 요약 (예시): 에이닷처럼 통화가 끝나면 요약·대화·할 일을 자동으로 보여주는 모습을 시연한다.
 *    웹은 통화 음성을 들을 수 없어 예시 대본을 쓰지만, 할 일 카드는 진짜 정리 기능이 요약 문장을 읽어 만든다.
 * 2) 직접 알려 주기: 말(🎤)이나 글로 남기면 같은 정리 기능이 일정·부탁 제안을 만든다.
 * 제안은 자동 등록하지 않고, 사용자가 확인한 것만 추가한다. 일정은 가족에게 확인 요청이 간다.
 */
export function CallNotePage() {
  const { id = '' } = useParams()
  const { state, run, toast } = useStore()
  const navigate = useNavigate()
  const other = memberOf(state, id)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const canListen = typeof window !== 'undefined' && !!makeRecognition()
  const me = memberOf(state, state.currentUserId)
  const demo = me && other ? demoCallScript(me, other) : null
  const [phase, setPhase] = useState<'analyzing' | 'ready'>('analyzing')
  const [showManual, setShowManual] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const nextKey = useRef(0)
  const withKeys = (list: CallSuggestion[]): Item[] => list.map((x) => ({ ...x, key: nextKey.current++ }))

  useEffect(() => () => rec.current?.stop(), [])

  // AI 요약 시연: 잠깐 '정리 중'을 보여준 뒤 요약과 할 일을 띄운다
  useEffect(() => {
    if (!demo) return
    const t = window.setTimeout(() => {
      setPhase('ready')
      setItems((list) => [...withKeys(extractFromCallNote(demo.note)), ...(list ?? [])])
    }, 1600)
    return () => window.clearTimeout(t)
  }, [id])

  function toggleMic() {
    if (listening) {
      rec.current?.stop()
      return
    }
    const r = makeRecognition()
    if (!r) return
    r.lang = 'ko-KR'
    r.interimResults = false
    r.continuous = true
    r.onresult = (e) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript
      if (text) setNote((n) => (n ? `${n} ${text}` : text).trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      toast('말을 알아듣지 못했어요. 다시 눌러 주세요.')
    }
    rec.current = r
    r.start()
    setListening(true)
  }

  function organize() {
    rec.current?.stop()
    const found = withKeys(extractFromCallNote(note))
    if (found.length === 0) toast('날짜나 부탁을 찾지 못했어요. "토요일 오후 2시 병원", "건전지 사 와"처럼 말해 보세요.')
    setItems((list) => [...(list ?? []), ...found])
    setNote('')
  }

  const update = (key: number, patch: Partial<Item>) => setItems((list) => list?.map((it) => (it.key === key ? { ...it, ...patch } : it)) ?? null)
  const remove = (key: number) => setItems((list) => list?.filter((it) => it.key !== key) ?? null)

  function add(it: Item) {
    if (it.kind === 'schedule') {
      const o = run(
        (s, c) => R.createSchedule(s, c, { title: it.title, startAt: it.startAt!, audienceIds: otherMemberIds(s) }),
        '일정을 올렸어요. 가족이 확인하면 정해져요.',
      )
      if (o.ok) update(it.key, { added: true })
    } else {
      const o = run(
        (s, c) =>
          R.createRequest(s, c, {
            title: it.title,
            detail: `통화에서 정한 내용: ${it.source}`,
            audienceIds: [id],
            purchase: it.purchase ? { spec: it.title, quantity: 1 } : undefined,
          }),
        `${other?.name ?? ''}에게 부탁을 보냈어요.`,
      )
      if (o.ok) update(it.key, { added: true })
    }
  }

  if (!other) return null
  const withName = josa(other.name, '과', '와')

  return (
    <main className="page call-note">
      <div className="call-note-head">
        <Avatar member={other} size={56} />
        <div>
          <div className="big">{withName} 통화했어요</div>
          <div className="muted">통화에서 정한 게 있나요?</div>
        </div>
      </div>

      <section className="card ai-card">
        <div className="ai-head">
          <b>🤖 AI 통화 요약</b>
          <span className="badge badge-yellow">예시</span>
        </div>
        {phase === 'analyzing' || !demo ? (
          <div className="ai-loading">
            <span className="ai-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            통화 내용을 정리하고 있어요…
          </div>
        ) : (
          <>
            <div className="muted small">통화 {formatDuration(demo.durationSec)}</div>
            <ul className="ai-summary">
              {demo.summary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <button className="btn btn-text ai-toggle" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? '대화 내용 접기' : '대화 내용 보기'}
            </button>
            {showTranscript && (
              <div className="ai-transcript">
                {demo.transcript.map((line, i) => (
                  <div key={i} className={`bubble ${line.who === 'me' ? 'bubble-me' : 'bubble-other'}`}>
                    <span className="bubble-who">{line.who === 'me' ? '나' : other.name}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            )}
            <p className="ai-disclaimer">예시 화면이에요. 실제 통화를 듣지 않았어요. 실제 서비스에서는 통화 녹음에 동의하면 AI가 이렇게 정리해 줘요.</p>
          </>
        )}
      </section>

      {items && items.length > 0 && <h3 className="section">정리된 할 일</h3>}
      {items?.map((it) => (
        <div key={it.key} className={`card suggestion ${it.added ? 'suggestion-added' : ''}`}>
          <div className="suggestion-kind">{it.kind === 'schedule' ? '📅 일정으로 추가' : `🙏 ${other.name}에게 부탁`}</div>
          <input className="input" value={it.title} disabled={it.added} onChange={(e) => update(it.key, { title: e.target.value })} aria-label="제목" />
          {it.kind === 'schedule' ? (
            <input
              className="input"
              type="datetime-local"
              value={it.startAt}
              disabled={it.added}
              onChange={(e) => update(it.key, { startAt: e.target.value })}
              aria-label="날짜와 시간"
            />
          ) : (
            <label className="check-row">
              <input type="checkbox" checked={!!it.purchase} disabled={it.added} onChange={(e) => update(it.key, { purchase: e.target.checked })} />
              사야 하는 물건이에요
            </label>
          )}
          <div className="muted small">근거: “{it.source}”</div>
          {it.added ? (
            <div className="suggestion-done">✓ 추가했어요{it.kind === 'schedule' && ` · ${formatDateTime(it.startAt!)}`}</div>
          ) : (
            <div className="row gap8">
              <button className="btn btn-primary grow" onClick={() => add(it)}>
                추가하기
              </button>
              <button className="btn btn-outline" onClick={() => remove(it.key)}>
                빼기
              </button>
            </div>
          )}
        </div>
      ))}

      {showManual ? (
        <section className="card soft manual">
          <b>직접 알려 주기</b>
          {canListen && (
            <button className={`mic ${listening ? 'mic-on' : ''}`} onClick={toggleMic}>
              <span className="mic-icon">🎤</span>
              {listening ? '듣고 있어요… 다 말하면 눌러 주세요' : '말로 알려 주기'}
            </button>
          )}
          <textarea
            className="input textarea call-textarea"
            rows={3}
            placeholder="예: 토요일 오후 2시에 김장하러 오기로 했어. 건전지도 사 오기로."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-primary btn-xl" disabled={!note.trim()} onClick={organize}>
            정리하기
          </button>
        </section>
      ) : (
        phase === 'ready' && (
          <button className="btn btn-outline" onClick={() => setShowManual(true)}>
            요약이 틀렸나요? 직접 알려 주기
          </button>
        )
      )}

      <button className="btn btn-text" onClick={() => navigate('/', { replace: true })}>
        {items?.some((i) => i.added) ? '다 했어요' : '정한 거 없어요'}
      </button>
    </main>
  )
}
