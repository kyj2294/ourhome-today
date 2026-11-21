import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRelative } from '../../domain/dates'
import { josa } from '../../domain/korean'
import {
  CALL_ME_OPTION,
  CARD_DESIGNS,
  CARD_REPLY_OPTIONS,
  type CardDesign,
  type FamilyQuestion,
  type FamilyState,
  QUESTION_PRESETS,
  cardOf,
  memberOf,
  nameOf,
} from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { CallButton } from './call'
import { CardPicker, MessageCard } from './cards'
import { AudiencePicker, Avatar, Badge, Modal } from './common'

/** 질문 빠른 선택에 어울리는 카드 */
const PRESET_CARD: Record<string, CardDesign> = { '💊': 'pill', '🍚': 'meal', '😊': 'cheer', '🏥': 'cheer' }

export interface QuestionForm {
  text: string
  options: string[]
  card?: CardDesign
  message: string
  targets: string[]
}

/** 기본 받는 사람: 부모님 (없으면 나 빼고 모두) */
export function defaultTargets(s: FamilyState): string[] {
  const parents = s.members.filter((m) => m.role === 'parent' && m.id !== s.currentUserId).map((m) => m.id)
  return parents.length ? parents : s.members.filter((m) => m.id !== s.currentUserId).map((m) => m.id)
}

/** 질문·카드·자동 안부가 함께 쓰는 입력 칸 */
export function QuestionFields({ form, setForm, cardMode = false }: { form: QuestionForm; setForm: (f: QuestionForm) => void; cardMode?: boolean }) {
  const { state } = useStore()
  const options = [...form.options, '', ''].slice(0, 3)
  const pickCard = (card?: CardDesign) => {
    const prev = cardOf(form.card)
    const next = cardOf(card)
    const keepMessage = form.message && form.message !== prev?.message
    const keepText = form.text && form.text !== prev?.title
    setForm({
      ...form,
      card,
      message: keepMessage ? form.message : (next?.message ?? ''),
      text: cardMode && !keepText ? (next?.title ?? form.text) : form.text,
    })
  }
  return (
    <>
      <div className="field">
        <span>카드 {cardMode ? '' : '(선택)'}</span>
        <CardPicker value={form.card} onChange={pickCard} allowNone={!cardMode} />
      </div>
      {form.card && (
        <label className="field">
          <span>카드에 쓸 말</span>
          <textarea className="input textarea" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </label>
      )}
      {!cardMode && (
        <label className="field">
          <span>질문</span>
          <input className="input" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="예: 오늘 산책 다녀오셨어요?" />
        </label>
      )}
      <div className="field">
        <span>답 버튼 (2~3개)</span>
        {options.map((o, i) => (
          <input
            key={i}
            className="input"
            value={o}
            placeholder={i === 2 ? '세 번째 버튼 (선택)' : `버튼 ${i + 1}`}
            onChange={(e) => setForm({ ...form, options: options.map((x, j) => (j === i ? e.target.value : x)) })}
          />
        ))}
      </div>
      <div className="field">
        <span>누구에게</span>
        <AudiencePicker s={state} value={form.targets} onChange={(targets) => setForm({ ...form, targets })} />
      </div>
    </>
  )
}

/**
 * 안부 묻기 (자녀 화면 맨 위)
 * "약 드셨어요?" 같은 질문, 마음 카드, 자동 안부(알람)로 들어가는 입구.
 */
export function AskParentsCard() {
  const { state } = useStore()
  const [draft, setDraft] = useState<{ form: QuestionForm; cardMode: boolean } | null>(null)
  const parents = state.members.filter((m) => m.role === 'parent' && m.id !== state.currentUserId)
  const title = parents.length ? `${parents.map((p) => p.name).join('·')}께 물어보기` : '가족에게 물어보기'
  const mine = state.routines.filter((r) => r.ownerId === state.currentUserId && r.enabled).length

  const open = (form: Omit<QuestionForm, 'targets'>, cardMode = false) => setDraft({ form: { ...form, targets: defaultTargets(state) }, cardMode })

  return (
    <section className="card ask-card">
      <b>💬 {title}</b>
      <div className="chips wrap">
        {QUESTION_PRESETS.map((p) => {
          const card = PRESET_CARD[p.icon]
          return (
            <button key={p.text} className="chip" onClick={() => open({ text: p.text, options: [...p.options], card, message: cardOf(card)?.message ?? '' })}>
              {p.icon} {p.text}
            </button>
          )
        })}
        <button className="chip" onClick={() => open({ text: '', options: ['네', '아니요'], message: '' })}>
          ✏️ 직접 쓰기
        </button>
      </div>
      <div className="row gap8">
        <button
          className="btn btn-tonal grow"
          onClick={() => open({ text: CARD_DESIGNS[2].title, options: [...CARD_REPLY_OPTIONS], card: 'love', message: CARD_DESIGNS[2].message }, true)}
        >
          💌 마음 카드
        </button>
        <Link to="/routines" className="btn btn-tonal grow">
          ⏰ 자동 안부{mine > 0 && ` (${mine})`}
        </Link>
      </div>
      {draft && <AskDialog initial={draft.form} cardMode={draft.cardMode} onClose={() => setDraft(null)} />}
    </section>
  )
}

function AskDialog({ initial, cardMode, onClose }: { initial: QuestionForm; cardMode: boolean; onClose: () => void }) {
  const { state, run } = useStore()
  const [form, setForm] = useState(initial)
  const send = () => {
    const names = form.targets.map((t) => nameOf(state, t)).join('·')
    const o = run(
      (s, c) => R.askQuestion(s, c, { text: form.text, options: form.options, targetIds: form.targets, card: form.card, message: form.message }),
      cardMode ? `${names}께 카드를 보냈어요` : `${names}께 물어봤어요`,
    )
    if (o.ok) onClose()
  }
  return (
    <Modal
      title={cardMode ? '마음 카드 보내기' : '물어보기'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={send}>
            보내기
          </button>
        </>
      }
    >
      {form.card && <MessageCard design={form.card} message={form.message} from={nameOf(state, state.currentUserId)} />}
      <QuestionFields form={form} setForm={setForm} cardMode={cardMode} />
      <p className="hint">부모님 화면에 {form.card ? '카드와 ' : ''}큰 버튼으로 떠요. 하나만 누르면 답이 와요.</p>
    </Modal>
  )
}

/** 내가 물어본 것과 받은 답 (자녀 화면) */
export function MyQuestions({ s }: { s: FamilyState }) {
  const mine = s.questions.filter((q) => q.askerId === s.currentUserId).slice(0, 3)
  if (mine.length === 0) return null
  return (
    <section className="card soft my-questions">
      {mine.map((q) => (
        <div key={q.id} className="q-result">
          <div className="q-result-head">
            <b>
              {q.card && `${cardOf(q.card)?.emoji} `}
              {q.text}
            </b>
            <span className="muted small">
              {q.routineId && '⏰ '}
              {formatRelative(q.createdAt)}
            </span>
          </div>
          {q.targetIds.map((t) => {
            const a = q.answers[t]
            return (
              <div key={t} className="q-answer-row">
                <Avatar member={memberOf(s, t)} size={26} />
                <span className="grow">{nameOf(s, t)}</span>
                {a ? (
                  <Badge tone={a.option === q.options[0] ? 'green' : a.option === CALL_ME_OPTION ? 'red' : 'yellow'}>{a.option}</Badge>
                ) : (
                  <Badge tone="gray">아직 답 전</Badge>
                )}
                {a?.option === CALL_ME_OPTION && <CallButton memberId={t} className="btn btn-tonal call-small" />}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

/** 부모님 화면: 질문(또는 카드) 하나에 큰 답 버튼 */
export function ParentQuestionAsk({ q, s }: { q: FamilyQuestion; s: FamilyState }) {
  const { run } = useStore()
  const me = s.currentUserId
  const answered = q.answers[me]
  const [changing, setChanging] = useState(false)
  const who = nameOf(s, q.askerId)
  const isCardOnly = !!q.card && q.text === cardOf(q.card)?.title

  if (answered && !changing) {
    return (
      <section className="p-card">
        {q.card && <MessageCard design={q.card} size="sm" />}
        <div className="p-ask-title">{q.text}</div>
        <p className="p-answered">✓ "{answered.option}"라고 답했어요</p>
        <button className="p-btn p-btn-soft" onClick={() => setChanging(true)}>
          답 바꾸기
        </button>
      </section>
    )
  }
  return (
    <section className="p-card p-ask">
      <div className="p-who">{q.card ? `${josa(who, '이', '가')} 카드를 보냈어요` : `${josa(who, '이', '가')} 물어봐요`}</div>
      {q.card && <MessageCard design={q.card} message={q.message} from={who} size="lg" />}
      {!isCardOnly && <div className="p-ask-title p-question">{q.text}</div>}
      <div className="p-answers">
        {q.options.map((o, i) => (
          <button
            key={o}
            className={`p-btn ${i === 0 ? 'p-btn-primary' : 'p-btn-soft'}`}
            onClick={() => run((st, c) => R.answerQuestion(st, c, q.id, o), `${who}에게 "${o}"라고 알렸어요`).ok && setChanging(false)}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  )
}
