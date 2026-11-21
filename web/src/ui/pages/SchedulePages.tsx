import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, formatDateTime, formatRelative, todayKey } from '../../domain/dates'
import {
  AVAILABILITY_LABEL,
  type Availability,
  type FamilyState,
  type SchedulePlan,
  currentResponse,
  memberOf,
  nameOf,
  needsReconfirm,
  otherMemberIds,
  postOf,
  scheduleOf,
} from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { AudiencePicker, Avatar, Badge, Empty, Modal, ScheduleBadge, SourcePostPreview, TopBar } from '../components/common'

const AVAILABILITIES: Availability[] = ['AVAILABLE', 'RESCHEDULE', 'UNAVAILABLE']

// ---------------------------------------------------------------------------
// 일정 제안
// ---------------------------------------------------------------------------

/** 날짜만 공유하는 데서 끝내지 않고 가족에게 가능/조정/어려움 응답을 요청한다. */
export function ScheduleFormPage() {
  const { state, run } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const source = postOf(state, params.get('postId') ?? undefined)

  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState(`${addDays(todayKey(), 1)}T12:00`)
  const [place, setPlace] = useState('')
  const [audience, setAudience] = useState(() => otherMemberIds(state))

  function submit() {
    const o = run(
      (s, ctx) => R.createSchedule(s, ctx, { sourcePostId: source?.id, title, startAt, place, audienceIds: audience }),
      '일정을 제안했어요',
    )
    if (o.ok) navigate(`/schedule/${o.id}`, { replace: true })
  }

  return (
    <>
      <TopBar title={source ? '이 글로 일정 제안' : '일정 제안하기'} back />
      <main className="page form">
        {source && <SourcePostPreview post={source} s={state} link={false} />}
        <label className="field">
          <span>어떤 일정인가요? (필수)</span>
          <input className="input" placeholder="예: 주말 김장하기" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>언제</span>
          <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <label className="field">
          <span>어디서 (선택)</span>
          <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        <h3 className="section">누구에게 응답을 받을까요?</h3>
        <AudiencePicker s={state} value={audience} onChange={setAudience} />
        <p className="hint">가족은 '가능해요 · 시간 바꿔요 · 이번엔 어려워요'로 답해요. 확인했다고 참석자로 넣지 않아요.</p>
      </main>
      <div className="bottom-action">
        <button className="btn btn-primary" disabled={!title.trim() || !startAt || audience.length === 0} onClick={submit}>
          제안하기
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// 일정 상세
// ---------------------------------------------------------------------------

/**
 * - 응답: 가능해요 · 시간 바꿔요 · 이번엔 어려워요
 * - 제안자가 시간을 바꾸면 기존 응답은 '재확인 필요'로 표시된다.
 * - 제안자가 일정을 확정한다.
 */
export function ScheduleDetailPage() {
  const { id = '' } = useParams()
  const { state, run } = useStore()
  const [rescheduling, setRescheduling] = useState(false)
  const p = scheduleOf(state, id)

  if (!p) {
    return (
      <>
        <TopBar title="일정" back />
        <Empty>일정을 찾을 수 없어요</Empty>
      </>
    )
  }
  const me = state.currentUserId
  const isProposer = p.proposerId === me
  const source = postOf(state, p.sourcePostId)

  return (
    <>
      <TopBar title="일정" back />
      <main className="page detail">
        <div className="row gap8 between">
          <h2 className="detail-title">{p.title}</h2>
          <ScheduleBadge p={p} />
        </div>
        <div className="card soft">
          <div className="big">{formatDateTime(p.startAt)}</div>
          {p.place && <div>📍 {p.place}</div>}
          <div className="muted small">{nameOf(state, p.proposerId)}님 제안</div>
        </div>
        {source && <SourcePostPreview post={source} s={state} />}

        {p.audienceIds.includes(me) && !p.canceled && <MyResponse key={`${p.id}-${p.version}-${me}`} p={p} me={me} />}

        {isProposer && !p.canceled && (
          <div className="actions">
            {!p.confirmed && (
              <button className="btn btn-primary" onClick={() => run((s, c) => R.confirmSchedule(s, c, p.id), '일정을 확정했어요')}>
                이 시간으로 확정하기
              </button>
            )}
            <button className="btn btn-outline" onClick={() => setRescheduling(true)}>
              시간 바꾸기
            </button>
            <button
              className="btn btn-text danger"
              onClick={() => confirm('이 일정을 취소할까요?') && run((s, c) => R.cancelSchedule(s, c, p.id), '일정을 취소했어요')}
            >
              일정 취소하기
            </button>
          </div>
        )}

        <h3 className="section">가족 응답</h3>
        <ul className="responses">
          {p.audienceIds.map((m) => (
            <ResponseRow key={m} p={p} memberId={m} s={state} />
          ))}
        </ul>

        <h3 className="section">기록</h3>
        <ul className="timeline">
          {[...p.history].reverse().map((h, i) => (
            <li key={i}>
              <Avatar member={memberOf(state, h.actorId)} size={26} />
              <span>
                <b>{nameOf(state, h.actorId)}</b> · {h.message}
                <span className="muted small"> · {formatRelative(h.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </main>
      {rescheduling && <RescheduleDialog p={p} onClose={() => setRescheduling(false)} />}
    </>
  )
}

function MyResponse({ p, me }: { p: SchedulePlan; me: string }) {
  const { run } = useStore()
  const current = currentResponse(p, me)
  const [note, setNote] = useState(current?.note ?? '')
  const respond = (a: Availability) => run((s, c) => R.respondSchedule(s, c, p.id, a, note), `${AVAILABILITY_LABEL[a]}로 응답했어요`)

  return (
    <div className="card soft">
      <b>내 응답</b>
      {needsReconfirm(p, me) && <p className="alert">시간이 바뀌었어요. 바뀐 시간 기준으로 다시 알려 주세요.</p>}
      <div className="segmented">
        {AVAILABILITIES.map((a) => (
          <button key={a} className={current?.availability === a ? 'on' : ''} onClick={() => respond(a)}>
            {AVAILABILITY_LABEL[a]}
          </button>
        ))}
      </div>
      <div className="row gap8">
        <input className="input grow" placeholder="한마디 (선택) 예: 오후 2시 이후가 좋아요" value={note} onChange={(e) => setNote(e.target.value)} />
        {current && (
          <button className="btn btn-text" onClick={() => respond(current.availability)}>
            저장
          </button>
        )}
      </div>
    </div>
  )
}

function ResponseRow({ p, memberId, s }: { p: SchedulePlan; memberId: string; s: FamilyState }) {
  const r = currentResponse(p, memberId)
  return (
    <li className="row gap10">
      <Avatar member={memberOf(s, memberId)} size={32} />
      <span className="grow">
        <div>{nameOf(s, memberId)}</div>
        {r?.note && <div className="muted small">{r.note}</div>}
      </span>
      {r ? (
        <Badge tone={r.availability === 'AVAILABLE' ? 'green' : r.availability === 'RESCHEDULE' ? 'yellow' : 'gray'}>
          {AVAILABILITY_LABEL[r.availability]}
        </Badge>
      ) : needsReconfirm(p, memberId) ? (
        <Badge tone="red">재확인 필요</Badge>
      ) : (
        // 미응답을 무관심으로 해석하지 않는다. 그냥 '아직 응답 전'이다.
        <Badge tone="gray">아직 응답 전</Badge>
      )}
    </li>
  )
}

function RescheduleDialog({ p, onClose }: { p: SchedulePlan; onClose: () => void }) {
  const { run } = useStore()
  const [startAt, setStartAt] = useState(p.startAt)
  return (
    <Modal
      title="시간 바꾸기"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button
            className="btn btn-primary"
            onClick={() => run((s, c) => R.rescheduleSchedule(s, c, p.id, startAt), '시간을 바꾸고 다시 응답을 요청했어요').ok && onClose()}
          >
            바꾸기
          </button>
        </>
      }
    >
      <p>바꾸면 기존 응답은 '재확인 필요'로 바뀌고 가족에게 다시 응답을 요청해요.</p>
      <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
    </Modal>
  )
}
