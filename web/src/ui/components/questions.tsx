import { useState } from 'react'
import { formatRelative } from '../../domain/dates'
import { josa } from '../../domain/korean'
import { CALL_ME_OPTION, type FamilyQuestion, type FamilyState, QUESTION_PRESETS, memberOf, nameOf } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { CallButton } from './call'
import { AudiencePicker, Avatar, Badge, Modal } from './common'

/**
 * 안부 질문 (자녀 화면)
 * "약 드셨어요?" 같은 질문을 보내면 부모님 화면에 큰 답 버튼 2~3개가 뜬다.
 * 답이 없어도 경고하지 않는다 — 그냥 '아직 답 전'이다.
 */
export function AskParentsCard() {
  const { state } = useStore()
  const [draft, setDraft] = useState<{ text: string; options: string[] } | null>(null)
  const parents = state.members.filter((m) => m.role === 'parent' && m.id !== state.currentUserId)
  const title = parents.length ? `${parents.map((p) => p.name).join('·')}께 물어보기` : '가족에게 물어보기'

  return (
    <section className="card ask-card">
      <b>💬 {title}</b>
      <div className="chips wrap">
        {QUESTION_PRESETS.map((p) => (
          <button key={p.text} className="chip" onClick={() => setDraft({ text: p.text, options: [...p.options] })}>
            {p.icon} {p.text}
          </button>
        ))}
        <button className="chip" onClick={() => setDraft({ text: '', options: ['네', '아니요'] })}>
          ✏️ 직접 쓰기
        </button>
      </div>
      {draft && <AskDialog initial={draft} onClose={() => setDraft(null)} />}
    </section>
  )
}

function AskDialog({ initial, onClose }: { initial: { text: string; options: string[] }; onClose: () => void }) {
  const { state, run } = useStore()
  const [text, setText] = useState(initial.text)
  const [options, setOptions] = useState<string[]>([...initial.options, '', ''].slice(0, 3))
  const parents = state.members.filter((m) => m.role === 'parent' && m.id !== state.currentUserId).map((m) => m.id)
  const [targets, setTargets] = useState<string[]>(parents.length ? parents : state.members.filter((m) => m.id !== state.currentUserId).map((m) => m.id))

  const send = () => {
    const names = targets.map((t) => nameOf(state, t)).join('·')
    if (run((s, c) => R.askQuestion(s, c, { text, options, targetIds: targets }), `${names}께 물어봤어요`).ok) onClose()
  }
  return (
    <Modal
      title="물어보기"
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
      <label className="field">
        <span>질문</span>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 오늘 산책 다녀오셨어요?" autoFocus={!initial.text} />
      </label>
      <div className="field">
        <span>답 버튼 (2~3개)</span>
        {options.map((o, i) => (
          <input
            key={i}
            className="input"
            value={o}
            placeholder={i === 2 ? '세 번째 버튼 (선택)' : `버튼 ${i + 1}`}
            onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
      </div>
      <div className="field">
        <span>누구에게</span>
        <AudiencePicker s={state} value={targets} onChange={setTargets} />
      </div>
      <p className="hint">부모님 화면에 큰 버튼으로 떠요. 하나만 누르면 답이 와요.</p>
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
            <b>{q.text}</b>
            <span className="muted small">{formatRelative(q.createdAt)}</span>
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

/** 부모님 화면: 질문 하나에 큰 답 버튼 */
export function ParentQuestionAsk({ q, s }: { q: FamilyQuestion; s: FamilyState }) {
  const { run } = useStore()
  const me = s.currentUserId
  const answered = q.answers[me]
  const [changing, setChanging] = useState(false)
  const who = nameOf(s, q.askerId)

  if (answered && !changing) {
    return (
      <section className="p-card">
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
      <div className="p-who">{josa(who, '이', '가')} 물어봐요</div>
      <div className="p-ask-title p-question">{q.text}</div>
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
