import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatDateTime, formatRelative } from '../../domain/dates'
import { josa } from '../../domain/korean'
import {
  type Availability,
  type FamilyRequest,
  type FamilyState,
  type SchedulePlan,
  currentResponse,
  memberOf,
  nameOf,
  needsReconfirm,
  otherMemberIds,
  postOf,
} from '../../domain/models'
import * as R from '../../domain/rules'
import { compressImage } from '../../store/images'
import { useStore } from '../../store/store'
import { Avatar, Photo } from '../components/common'

/*
 * 부모님 화면 — 어르신이 쓰기 쉽게
 * - 큰 글씨, 큰 버튼, 한 화면에서 끝나게
 * - 어려운 말(담당·원글·재확인) 대신 쉬운 말
 * - 버튼 한 번으로 답하기
 */

const ANSWERS: { a: Availability; label: string }[] = [
  { a: 'AVAILABLE', label: '좋아요 👍' },
  { a: 'RESCHEDULE', label: '다른 시간이 좋아요' },
  { a: 'UNAVAILABLE', label: '이번엔 어려워요' },
]
const ANSWER_LABEL: Record<Availability, string> = { AVAILABLE: '좋아요', RESCHEDULE: '다른 시간이 좋아요', UNAVAILABLE: '이번엔 어려워요' }



/** 부모님이 이해하기 쉬운 부탁 상태 문장 */
function plainStatus(r: FamilyRequest, s: FamilyState): string {
  const who = r.assigneeId ? nameOf(s, r.assigneeId) : ''
  switch (r.status) {
    case 'OPEN':
      return '아직 아무도 안 맡았어요'
    case 'CLAIMED':
      return `${josa(who, '이', '가')} 하기로 했어요`
    case 'IN_PROGRESS':
      return r.purchase ? `${josa(who, '이', '가')} 주문했어요. 받으시면 눌러 주세요` : `${josa(who, '이', '가')} 하고 있어요`
    case 'DONE':
      return '다 됐어요 👍'
    case 'CANCELED':
      return '취소했어요'
  }
}

export function ScheduleAsk({ p, s }: { p: SchedulePlan; s: FamilyState }) {
  const { run } = useStore()
  const me = s.currentUserId
  const answered = currentResponse(p, me)
  const [changing, setChanging] = useState(false)
  const who = nameOf(s, p.proposerId)

  if (answered && !changing) {
    return (
      <section className="p-card">
        <div className="p-ask-title">{p.title}</div>
        <div className="p-when">{formatDateTime(p.startAt)}</div>
        <p className="p-answered">
          ✓ "{ANSWER_LABEL[answered.availability]}"라고 답했어요{p.confirmed && ' · 날짜가 정해졌어요'}
        </p>
        <button className="p-btn p-btn-soft" onClick={() => setChanging(true)}>
          답 바꾸기
        </button>
      </section>
    )
  }
  return (
    <section className="p-card p-ask">
      <div className="p-who">
        {needsReconfirm(p, me) ? `${josa(who, '이', '가')} 시간을 바꿨어요. 다시 알려 주세요` : `${josa(who, '이', '가')} 물어봐요`}
      </div>
      <div className="p-ask-title">{p.title}</div>
      <div className="p-when">
        {formatDateTime(p.startAt)}
        {p.place && ` · ${p.place}`}
      </div>
      <div className="p-answers">
        {ANSWERS.map(({ a, label }) => (
          <button
            key={a}
            className={`p-btn ${a === 'AVAILABLE' ? 'p-btn-primary' : 'p-btn-soft'}`}
            onClick={() => {
              if (run((st, c) => R.respondSchedule(st, c, p.id, a), `${who}에게 "${ANSWER_LABEL[a]}"라고 알렸어요`).ok) setChanging(false)
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

export function RequestAsk({ r, s }: { r: FamilyRequest; s: FamilyState }) {
  const { run } = useStore()
  const who = nameOf(s, r.requesterId)
  const mine = r.assigneeId === s.currentUserId
  return (
    <section className="p-card p-ask">
      <div className="p-who">{mine ? '제가 하기로 했어요' : `${josa(who, '이', '가')} 부탁했어요`}</div>
      <div className="p-ask-title">{r.title}</div>
      {r.detail && <p className="p-text">{r.detail}</p>}
      {r.status === 'OPEN' && (
        <button className="p-btn p-btn-primary" onClick={() => run((st, c) => R.claimRequest(st, c, r.id), `${who}에게 "제가 할게요"라고 알렸어요`)}>
          제가 할게요
        </button>
      )}
      {mine && r.status === 'CLAIMED' && r.purchase && (
        <button className="p-btn p-btn-primary" onClick={() => run((st, c) => R.markInProgress(st, c, r.id), '주문했다고 알렸어요')}>
          주문했어요
        </button>
      )}
      {mine && !r.purchase && (
        <button className="p-btn p-btn-primary" onClick={() => run((st, c) => R.markDone(st, c, r.id), '다 했다고 알렸어요')}>
          다 했어요
        </button>
      )}
      {mine && r.purchase && r.status === 'IN_PROGRESS' && <p className="p-answered">주문했어요. {josa(who, '이', '가')} 받으면 끝나요.</p>}
    </section>
  )
}

export function MyRequest({ r, s }: { r: FamilyRequest; s: FamilyState }) {
  const { run } = useStore()
  return (
    <section className={`p-card ${r.status === 'DONE' ? 'p-done' : ''}`}>
      <div className="p-ask-title">{r.title}</div>
      <p className="p-status">{plainStatus(r, s)}</p>
      {r.purchase && r.status === 'IN_PROGRESS' && (
        <button className="p-btn p-btn-primary" onClick={() => run((st, c) => R.markDone(st, c, r.id), '받았다고 알렸어요. 고마워요!')}>
          받았어요
        </button>
      )}
    </section>
  )
}

/** 부모님 화면 공통: 큰 "돌아가기" */
function BackBar({ title }: { title: string }) {
  const navigate = useNavigate()
  return (
    <header className="p-backbar">
      <button className="p-back" onClick={() => navigate('/', { replace: true })}>
        ← 돌아가기
      </button>
      <h1>{title}</h1>
    </header>
  )
}

// ---------------------------------------------------------------------------
// 사진 보내기
// ---------------------------------------------------------------------------

export function ParentCompose() {
  const { run, toast, uploadImage } = useStore()
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<string[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function pick(files: FileList | null) {
    if (!files) return
    setBusy(true)
    try {
      const urls = await Promise.all(Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 5 - photos.length).map((f) => compressImage(f).then(uploadImage)))
      setPhotos((p) => [...p, ...urls].slice(0, 5))
    } catch {
      toast('사진을 불러오지 못했어요')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <main className="p-page">
      <BackBar title="사진 보내기" />
      <button className="p-btn p-btn-soft p-pick" onClick={() => input.current?.click()} disabled={busy || photos.length >= 5}>
        {busy ? '불러오는 중…' : photos.length ? '📷 사진 더 고르기' : '📷 사진 고르기'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {photos.length > 0 && (
        <div className="p-picked">
          {photos.map((p, i) => (
            <div key={i} className="p-picked-item">
              <Photo src={p} className="p-picked-photo" />
              <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>빼기</button>
            </div>
          ))}
        </div>
      )}
      <label className="p-label" htmlFor="p-text">
        하고 싶은 말 (안 써도 돼요)
      </label>
      <textarea id="p-text" className="p-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 꽃이 피었어요" />
      <div className="p-actions">
        <button
          className="p-btn p-btn-primary"
          disabled={busy || (!text.trim() && photos.length === 0)}
          onClick={() => run((s, c) => R.createPost(s, c, text, photos), '가족에게 보냈어요').ok && navigate('/', { replace: true })}
        >
          가족에게 보내기
        </button>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// 부탁하기 — 내용만 쓰면 끝
// ---------------------------------------------------------------------------

export function ParentRequest() {
  const { state, run } = useStore()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [buy, setBuy] = useState<boolean | null>(null)
  const [qty, setQty] = useState(1)

  function send() {
    const t = text.trim()
    const title = t.length > 30 ? `${t.slice(0, 28)}…` : t
    const o = run(
      (s, c) =>
        R.createRequest(s, c, {
          title,
          detail: t.length > 30 ? t : '',
          audienceIds: otherMemberIds(s),
          purchase: buy ? { spec: t, quantity: qty } : undefined,
        }),
      '가족에게 부탁했어요. 누가 맡으면 첫 화면에 보여요.',
    )
    if (o.ok) navigate('/', { replace: true })
  }

  return (
    <main className="p-page">
      <BackBar title="부탁하기" />
      <label className="p-label" htmlFor="p-req">
        무엇을 부탁할까요?
      </label>
      <textarea id="p-req" className="p-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 정수기 필터 좀 사다 줘" autoFocus />

      <div className="p-label">사야 하는 물건인가요?</div>
      <div className="p-yesno">
        <button className={`p-btn ${buy === true ? 'p-btn-primary' : 'p-btn-soft'}`} onClick={() => setBuy(true)}>
          네
        </button>
        <button className={`p-btn ${buy === false ? 'p-btn-primary' : 'p-btn-soft'}`} onClick={() => setBuy(false)}>
          아니요
        </button>
      </div>
      {buy && (
        <>
          <div className="p-label">몇 개요?</div>
          <div className="p-stepper">
            <button className="p-btn p-btn-soft" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="하나 빼기">
              −
            </button>
            <span>{qty}개</span>
            <button className="p-btn p-btn-soft" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="하나 더">
              +
            </button>
          </div>
        </>
      )}
      <p className="p-muted">{state.members.filter((m) => m.id !== state.currentUserId).map((m) => m.name).join(', ')}에게 보내요.</p>
      <div className="p-actions">
        <button className="p-btn p-btn-primary" disabled={!text.trim()} onClick={send}>
          부탁 보내기
        </button>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// 사진 크게 보기 + 댓글
// ---------------------------------------------------------------------------

export function ParentPost() {
  const { id = '' } = useParams()
  const { state, run } = useStore()
  const [comment, setComment] = useState('')
  const post = postOf(state, id)

  useEffect(() => {
    run((s) => R.markPostRead(s, id))
  }, [id, run])

  if (!post) {
    return (
      <main className="p-page">
        <BackBar title="가족 소식" />
        <p className="p-text">사진을 찾을 수 없어요.</p>
      </main>
    )
  }
  return (
    <main className="p-page">
      <BackBar title={`${nameOf(state, post.authorId)}의 소식`} />
      {post.photos.map((p, i) => (
        <Photo key={i} src={p} className="p-photo" />
      ))}
      {post.text && <p className="p-text p-text-lg">{post.text}</p>}
      <div className="p-muted">{formatRelative(post.createdAt)}</div>

      <h2 className="p-section">💬 댓글</h2>
      {post.comments.length === 0 && <p className="p-muted">아직 댓글이 없어요.</p>}
      {post.comments.map((c) => (
        <div key={c.id} className="p-comment">
          <Avatar member={memberOf(state, c.authorId)} size={40} />
          <div>
            <b>{nameOf(state, c.authorId)}</b>
            <p>{c.text}</p>
          </div>
        </div>
      ))}
      <textarea className="p-input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="댓글 쓰기" />
      <button
        className="p-btn p-btn-primary"
        disabled={!comment.trim()}
        onClick={() => run((s, c) => R.addComment(s, c, id, comment), '댓글을 남겼어요').ok && setComment('')}
      >
        댓글 보내기
      </button>
    </main>
  )
}
