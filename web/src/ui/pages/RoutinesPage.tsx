import { useState } from 'react'
import { CARD_DESIGNS, DAY_LABELS, QUESTION_PRESETS, type CardDesign, type Routine, cardOf, describeDays, describeTime, nameOf } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { CardPicker, MessageCard } from '../components/cards'
import { AudiencePicker, Empty, Modal, TopBar } from '../components/common'
import { defaultTargets } from '../components/questions'

/*
 * 자동화 (자녀 화면 탭) — 핸드폰 알람처럼
 * 자녀가 "언제 · 무엇을 · 누구에게"를 정해 두면, 그 시간에 부모님 화면에 질문·카드·알림이 뜬다.
 */

type Action = 'question' | 'card' | 'reminder'

interface Draft {
  id?: string
  days: number[]
  times: string[]
  action: Action
  text: string
  options: string[]
  card?: CardDesign
  message: string
  targets: string[]
}

const ALL = [0, 1, 2, 3, 4, 5, 6]
const TEMPLATES: { label: string; draft: Omit<Draft, 'targets'> }[] = [
  { label: '💊 아침·저녁 약 확인', draft: { days: ALL, times: ['08:00', '20:00'], action: 'question', text: '약 드셨어요?', options: [...QUESTION_PRESETS[0].options], card: 'pill', message: cardOf('pill')!.message } },
  { label: '🍚 점심 식사 확인', draft: { days: ALL, times: ['12:30'], action: 'question', text: '점심 드셨어요?', options: ['먹었어요', '아직이요'], card: 'meal', message: cardOf('meal')!.message } },
  { label: '💧 물 마실 시간 알림', draft: { days: ALL, times: ['10:00', '15:00'], action: 'reminder', text: '💧 물 한 잔 드실 시간이에요', options: [], message: '' } },
  { label: '☀️ 평일 아침 응원 카드', draft: { days: [1, 2, 3, 4, 5], times: ['09:00'], action: 'card', text: '힘내세요', options: ['고마워 ❤️', '나도 사랑해 😊'], card: 'cheer', message: cardOf('cheer')!.message } },
]

const ACTION_INFO: Record<Action, { icon: string; label: string; desc: string }> = {
  question: { icon: '❓', label: '질문 + 답 버튼', desc: '예: 약 드셨어요? → 먹었어요 / 아직이요' },
  card: { icon: '💌', label: '카드 보내기', desc: '예쁜 카드에 마음을 담아 보내요' },
  reminder: { icon: '🔔', label: '알림만', desc: '예: 물 드실 시간이에요 (답은 "알겠어요" 하나)' },
}

const actionOf = (r: Routine): Action => (r.reminder ? 'reminder' : r.card && r.text === cardOf(r.card)?.title ? 'card' : 'question')

export function RoutinesPage() {
  const { state } = useStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const mine = state.routines.filter((r) => r.ownerId === state.currentUserId)
  const others = state.routines.filter((r) => r.ownerId !== state.currentUserId)

  const startNew = (t?: (typeof TEMPLATES)[number]) =>
    setDraft(
      t
        ? { ...t.draft, days: [...t.draft.days], times: [...t.draft.times], options: [...t.draft.options], targets: defaultTargets(state) }
        : { days: ALL, times: ['09:00'], action: 'question', text: '', options: ['네', '아니요'], message: '', targets: defaultTargets(state) },
    )
  const edit = (r: Routine) =>
    setDraft({ id: r.id, days: [...r.days], times: [...r.times], action: actionOf(r), text: r.text, options: [...r.options], card: r.card, message: r.message ?? '', targets: [...r.targetIds] })

  return (
    <>
      <TopBar title="자동화" />
      <main className="page detail">
        <p className="hint">알람처럼 시간을 정해 두면 그때마다 부모님 화면에 질문·카드·알림이 떠요. 부모님은 버튼 하나로 답해요.</p>

        {mine.length === 0 && <Empty>아직 만든 자동화가 없어요</Empty>}
        {mine.map((r) => (
          <AlarmRow key={r.id} r={r} onEdit={() => edit(r)} />
        ))}

        <button className="btn btn-primary" onClick={() => startNew()}>
          + 새 자동화 만들기
        </button>
        <h3 className="section">추천</h3>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.label} className="template-card" onClick={() => startNew(t)}>
              <b>{t.label}</b>
              <span className="muted small">
                {describeDays(t.draft.days)} · {t.draft.times.map(describeTime).join(', ')}
              </span>
            </button>
          ))}
        </div>

        {others.length > 0 && (
          <>
            <h3 className="section">다른 가족이 만든 자동화</h3>
            {others.map((r) => (
              <div key={r.id} className="alarm alarm-readonly">
                <div className="alarm-times">{r.times.map(describeTime).join(' · ')}</div>
                <div className="muted small">
                  {describeDays(r.days)} · {ACTION_INFO[actionOf(r)].icon} {r.text} — {nameOf(state, r.ownerId)}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
      {draft && <AutomationWizard initial={draft} onClose={() => setDraft(null)} />}
    </>
  )
}

/** 알람 앱처럼: 큰 시간, 요일 글자, 켜기/끄기 */
function AlarmRow({ r, onEdit }: { r: Routine; onEdit: () => void }) {
  const { state, run } = useStore()
  const action = actionOf(r)
  return (
    <div className={`alarm ${r.enabled ? '' : 'alarm-off'}`}>
      <div className="alarm-top">
        <button className="alarm-main" onClick={onEdit} aria-label="고치기">
          <div className="alarm-times">{r.times.map(describeTime).join(' · ')}</div>
          <div className="alarm-days">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <span key={d} className={r.days.includes(d) ? 'on' : ''}>
                {DAY_LABELS[d]}
              </span>
            ))}
          </div>
          <div className="alarm-what">
            {ACTION_INFO[action].icon} {r.card && action !== 'reminder' && `${cardOf(r.card)?.emoji} `}
            {r.text}
            <span className="muted"> → {r.targetIds.map((t) => nameOf(state, t)).join('·')}</span>
          </div>
        </button>
        <input
          type="checkbox"
          className="switch"
          checked={r.enabled}
          aria-label="켜기/끄기"
          onChange={(e) => run((s, c) => R.setRoutineEnabled(s, c, r.id, e.target.checked), e.target.checked ? '켰어요' : '껐어요')}
        />
      </div>
      <div className="row gap8">
        <button className="btn btn-text" onClick={onEdit}>
          고치기
        </button>
        <button className="btn btn-text" onClick={() => run((s, c) => R.sendRoutineNow(s, c, r.id), '지금 한 번 보냈어요')}>
          지금 보내 보기
        </button>
        <button className="btn btn-text danger" onClick={() => confirm('이 자동화를 지울까요?') && run((s) => R.deleteRoutine(s, r.id), '지웠어요')}>
          지우기
        </button>
      </div>
    </div>
  )
}

/** 만들기·고치기: ① 언제 → ② 무엇을 → ③ 누구에게 */
function AutomationWizard({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const { state, run } = useStore()
  const [d, setD] = useState(initial)
  const [step, setStep] = useState(initial.id ? 3 : 1)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const quick = [
    { label: '매일', days: ALL },
    { label: '평일', days: [1, 2, 3, 4, 5] },
    { label: '주말', days: [0, 6] },
  ]
  const toggleDay = (n: number) => set({ days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n] })

  const chooseAction = (action: Action) => {
    if (action === 'card') {
      const c = cardOf(d.card) ?? CARD_DESIGNS[2]
      set({ action, card: c.id, text: c.title, message: d.message || c.message, options: ['고마워 ❤️', '나도 사랑해 😊'] })
    } else if (action === 'reminder') {
      set({ action, card: undefined, text: d.action === 'reminder' ? d.text : '', options: [] })
    } else {
      set({ action, text: d.action === 'question' ? d.text : '', options: d.action === 'question' ? d.options : ['네', '아니요'] })
    }
  }
  const pickCard = (card?: CardDesign) => {
    const prev = cardOf(d.card)
    const next = cardOf(card)
    set({
      card,
      message: d.message && d.message !== prev?.message ? d.message : (next?.message ?? ''),
      text: d.action === 'card' ? (next?.title ?? d.text) : d.text,
    })
  }

  const save = () => {
    const draft = {
      text: d.text,
      options: d.options,
      targetIds: d.targets,
      card: d.action === 'reminder' ? undefined : d.card,
      message: d.message,
      reminder: d.action === 'reminder',
      days: d.days,
      times: d.times,
    }
    const o = d.id ? run((s, c) => R.updateRoutine(s, c, d.id!, draft), '고쳤어요') : run((s, c) => R.createRoutine(s, c, draft), '자동화를 만들었어요')
    if (o.ok) onClose()
  }

  const options = [...d.options, '', ''].slice(0, 3)
  const steps = ['언제', '무엇을', '누구에게']

  return (
    <Modal
      title={d.id ? '자동화 고치기' : '새 자동화'}
      onClose={onClose}
      footer={
        <>
          {step > 1 ? (
            <button className="btn btn-text" onClick={() => setStep(step - 1)}>
              이전
            </button>
          ) : (
            <button className="btn btn-text" onClick={onClose}>
              닫기
            </button>
          )}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              다음
            </button>
          ) : (
            <button className="btn btn-primary" onClick={save}>
              {d.id ? '저장' : '만들기'}
            </button>
          )}
        </>
      }
    >
      <ol className="wizard-steps">
        {steps.map((label, i) => (
          <li key={label} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>
            <button onClick={() => setStep(i + 1)}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <div className="field">
            <span>시간</span>
            {d.times.map((t, i) => (
              <div key={i} className="row gap8">
                <input className="input grow time-input" type="time" value={t} onChange={(e) => set({ times: d.times.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`시간 ${i + 1}`} />
                {d.times.length > 1 && (
                  <button className="btn btn-text" onClick={() => set({ times: d.times.filter((_, j) => j !== i) })}>
                    빼기
                  </button>
                )}
              </div>
            ))}
            {d.times.length < 4 && (
              <button className="btn btn-text" onClick={() => set({ times: [...d.times, '18:00'] })}>
                + 시간 추가
              </button>
            )}
          </div>
          <div className="field">
            <span>반복 · {describeDays(d.days) || '요일을 골라 주세요'}</span>
            <div className="chips">
              {quick.map((q) => (
                <button key={q.label} type="button" className={`chip ${describeDays(d.days) === q.label ? 'chip-on' : ''}`} onClick={() => set({ days: q.days })}>
                  {q.label}
                </button>
              ))}
            </div>
            <div className="day-picker">
              {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                <button key={n} type="button" className={d.days.includes(n) ? 'on' : ''} onClick={() => toggleDay(n)}>
                  {DAY_LABELS[n]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="action-choices">
            {(Object.keys(ACTION_INFO) as Action[]).map((a) => (
              <button key={a} className={`action-choice ${d.action === a ? 'on' : ''}`} onClick={() => chooseAction(a)}>
                <span className="action-icon">{ACTION_INFO[a].icon}</span>
                <span>
                  <b>{ACTION_INFO[a].label}</b>
                  <span className="muted small">{ACTION_INFO[a].desc}</span>
                </span>
              </button>
            ))}
          </div>
          {d.action !== 'reminder' && (
            <div className="field">
              <span>카드 {d.action === 'card' ? '' : '(선택)'}</span>
              <CardPicker value={d.card} onChange={pickCard} allowNone={d.action !== 'card'} />
            </div>
          )}
          {d.card && d.action !== 'reminder' && (
            <>
              <MessageCard design={d.card} message={d.message} from={nameOf(state, state.currentUserId)} />
              <label className="field">
                <span>카드에 쓸 말</span>
                <textarea className="input textarea" rows={2} value={d.message} onChange={(e) => set({ message: e.target.value })} />
              </label>
            </>
          )}
          {d.action !== 'card' && (
            <label className="field">
              <span>{d.action === 'reminder' ? '알릴 내용' : '질문'}</span>
              <input
                className="input"
                value={d.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder={d.action === 'reminder' ? '예: 💧 물 한 잔 드실 시간이에요' : '예: 약 드셨어요?'}
              />
            </label>
          )}
          {d.action !== 'reminder' && (
            <div className="field">
              <span>답 버튼 (2~3개)</span>
              {options.map((o, i) => (
                <input
                  key={i}
                  className="input"
                  value={o}
                  placeholder={i === 2 ? '세 번째 버튼 (선택)' : `버튼 ${i + 1}`}
                  onChange={(e) => set({ options: options.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <div className="field">
            <span>누구에게</span>
            <AudiencePicker s={state} value={d.targets} onChange={(targets) => set({ targets })} />
          </div>
          <div className="card soft wizard-summary">
            <b>이렇게 보내요</b>
            <div>
              ⏰ {describeDays(d.days) || '요일 없음'} · {d.times.map(describeTime).join(', ')}
            </div>
            <div>
              {ACTION_INFO[d.action].icon} {d.text || '(내용 없음)'}
              {d.action !== 'reminder' && d.options.filter(Boolean).length > 0 && <span className="muted"> → {d.options.filter(Boolean).join(' / ')}</span>}
            </div>
            <div>👤 {d.targets.map((t) => nameOf(state, t)).join('·') || '받는 사람 없음'}</div>
          </div>
        </>
      )}
    </Modal>
  )
}
