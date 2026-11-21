import { useState } from 'react'
import { DAY_LABELS, QUESTION_PRESETS, type Routine, cardOf, describeDays, describeTime, nameOf } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { MessageCard } from '../components/cards'
import { Empty, Modal, TopBar } from '../components/common'
import { type QuestionForm, QuestionFields, defaultTargets } from '../components/questions'

/** 자주 쓰는 자동 안부 */
const TEMPLATES: { label: string; form: Omit<QuestionForm, 'targets'>; days: number[]; times: string[] }[] = [
  {
    label: '💊 아침·저녁 약 (매일 8시, 20시)',
    form: { text: '약 드셨어요?', options: [...QUESTION_PRESETS[0].options], card: 'pill', message: cardOf('pill')!.message },
    days: [0, 1, 2, 3, 4, 5, 6],
    times: ['08:00', '20:00'],
  },
  {
    label: '🍚 점심 식사 (매일 12시 30분)',
    form: { text: '점심 드셨어요?', options: ['먹었어요', '아직이요'], card: 'meal', message: cardOf('meal')!.message },
    days: [0, 1, 2, 3, 4, 5, 6],
    times: ['12:30'],
  },
  {
    label: '😊 아침 안부 (평일 9시)',
    form: { text: '오늘 몸은 괜찮으세요?', options: [...QUESTION_PRESETS[2].options], card: 'cheer', message: cardOf('cheer')!.message },
    days: [1, 2, 3, 4, 5],
    times: ['09:00'],
  },
]

/**
 * 자동 안부 — 핸드폰 알람처럼 정한 요일·시간에 질문을 보낸다.
 * 부모님 화면에는 그 시간에 카드와 큰 답 버튼이 뜬다.
 */
export function RoutinesPage() {
  const { state, run } = useStore()
  const [editing, setEditing] = useState<{ form: QuestionForm; days: number[]; times: string[] } | null>(null)
  const mine = state.routines.filter((r) => r.ownerId === state.currentUserId)
  const others = state.routines.filter((r) => r.ownerId !== state.currentUserId)

  const startNew = (t?: (typeof TEMPLATES)[number]) =>
    setEditing({
      form: t ? { ...t.form, options: [...t.form.options], targets: defaultTargets(state) } : { text: '', options: ['네', '아니요'], message: '', targets: defaultTargets(state) },
      days: t ? [...t.days] : [0, 1, 2, 3, 4, 5, 6],
      times: t ? [...t.times] : ['09:00'],
    })

  return (
    <>
      <TopBar title="자동 안부" back />
      <main className="page detail">
        <p className="hint">핸드폰 알람처럼 정한 시간에 부모님께 질문이 가요. 부모님은 큰 버튼 하나로 답해요.</p>

        {mine.length === 0 && <Empty>아직 만든 자동 안부가 없어요</Empty>}
        {mine.map((r) => (
          <RoutineRow key={r.id} r={r} />
        ))}

        <h3 className="section">새로 만들기</h3>
        <div className="actions">
          {TEMPLATES.map((t) => (
            <button key={t.label} className="btn btn-outline template-btn" onClick={() => startNew(t)}>
              {t.label}
            </button>
          ))}
          <button className="btn btn-primary" onClick={() => startNew()}>
            + 직접 만들기
          </button>
        </div>

        {others.length > 0 && (
          <>
            <h3 className="section">다른 가족이 만든 자동 안부</h3>
            {others.map((r) => (
              <div key={r.id} className="card soft routine">
                <div className="routine-when">
                  {describeDays(r.days)} · {r.times.map(describeTime).join(', ')}
                </div>
                <div>
                  {r.card && `${cardOf(r.card)?.emoji} `}
                  {r.text} <span className="muted small">— {nameOf(state, r.ownerId)}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
      {editing && (
        <RoutineDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(f, days, times) =>
            run(
              (s, c) => R.createRoutine(s, c, { text: f.text, options: f.options, targetIds: f.targets, card: f.card, message: f.message, days, times }),
              '자동 안부를 만들었어요',
            ).ok && setEditing(null)
          }
        />
      )}
    </>
  )
}

function RoutineRow({ r }: { r: Routine }) {
  const { state, run } = useStore()
  return (
    <div className={`card routine ${r.enabled ? '' : 'routine-off'}`}>
      <div className="row between gap8">
        <div className="routine-when">
          {r.times.map(describeTime).join(', ')}
          <span className="muted"> · {describeDays(r.days)}</span>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={r.enabled}
          aria-label="켜기/끄기"
          onChange={(e) => run((s, c) => R.setRoutineEnabled(s, c, r.id, e.target.checked), e.target.checked ? '켰어요' : '껐어요')}
        />
      </div>
      <div className="routine-body">
        {r.card && <MessageCard design={r.card} size="sm" />}
        <div className="grow">
          <b>{r.text}</b>
          <div className="muted small">
            {r.targetIds.map((t) => nameOf(state, t)).join('·')}께 · 답: {r.options.join(' / ')}
          </div>
        </div>
      </div>
      <div className="row gap8">
        <button className="btn btn-tonal grow" onClick={() => run((s, c) => R.sendRoutineNow(s, c, r.id), '지금 한 번 보냈어요')}>
          지금 보내 보기
        </button>
        <button className="btn btn-text danger" onClick={() => confirm('이 자동 안부를 지울까요?') && run((s) => R.deleteRoutine(s, r.id), '지웠어요')}>
          지우기
        </button>
      </div>
    </div>
  )
}

function RoutineDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: { form: QuestionForm; days: number[]; times: string[] }
  onClose: () => void
  onSave: (f: QuestionForm, days: number[], times: string[]) => void
}) {
  const [form, setForm] = useState(initial.form)
  const [days, setDays] = useState(initial.days)
  const [times, setTimes] = useState(initial.times)
  const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])
  const quick = [
    { label: '매일', days: [0, 1, 2, 3, 4, 5, 6] },
    { label: '평일', days: [1, 2, 3, 4, 5] },
    { label: '주말', days: [0, 6] },
  ]
  return (
    <Modal
      title="자동 안부 만들기"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={() => onSave(form, days, times)}>
            만들기
          </button>
        </>
      }
    >
      <div className="field">
        <span>시간</span>
        {times.map((t, i) => (
          <div key={i} className="row gap8">
            <input className="input grow" type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`시간 ${i + 1}`} />
            {times.length > 1 && (
              <button className="btn btn-text" onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                빼기
              </button>
            )}
          </div>
        ))}
        {times.length < 4 && (
          <button className="btn btn-text" onClick={() => setTimes([...times, '18:00'])}>
            + 시간 추가
          </button>
        )}
      </div>
      <div className="field">
        <span>요일 · {describeDays(days) || '없음'}</span>
        <div className="chips">
          {quick.map((q) => (
            <button key={q.label} type="button" className={`chip ${describeDays(days) === q.label ? 'chip-on' : ''}`} onClick={() => setDays(q.days)}>
              {q.label}
            </button>
          ))}
        </div>
        <div className="day-picker">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" className={days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      {form.card && <MessageCard design={form.card} message={form.message} />}
      <QuestionFields form={form} setForm={setForm} />
    </Modal>
  )
}
