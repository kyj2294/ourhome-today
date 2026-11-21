import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, formatDue, formatRelative, todayKey } from '../../domain/dates'
import {
  type FamilyRequest,
  type FamilyState,
  isRequestActive,
  memberOf,
  nameOf,
  otherMemberIds,
  postOf,
  requestOf,
} from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { AudiencePicker, Avatar, Empty, Modal, RequestBadge, SourcePostPreview, TopBar } from '../components/common'
import { Icon } from '../components/icons'

/** 희망 시점 빠른 선택. 날짜를 꼭 정하지 않아도 된다. */
const DUE_OPTIONS = [
  { label: '기한 없음', days: null },
  { label: '오늘', days: 0 },
  { label: '3일 안에', days: 3 },
  { label: '다음 주까지', days: 7 },
] as const

function DuePicker({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const today = todayKey()
  return (
    <div className="chips">
      {DUE_OPTIONS.map((o) => {
        const v = o.days === null ? undefined : addDays(today, o.days)
        return (
          <button type="button" key={o.label} className={`chip ${value === v ? 'chip-on' : ''}`} onClick={() => onChange(v)}>
            {o.label}
          </button>
        )
      })}
      <input className="input date-input" type="date" value={value ?? ''} min={today} onChange={(e) => onChange(e.target.value || undefined)} aria-label="날짜 직접 고르기" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 부탁 등록
// ---------------------------------------------------------------------------

/**
 * 무엇을 부탁하는지와 공유 대상만 필수다.
 * 원글에서 넘어온 경우 원글의 사진·설명을 그대로 보여주고 다시 올리지 않는다.
 * 구매 부탁일 때만 제품 규격·수량을 덧붙인다.
 */
export function RequestFormPage() {
  const { state, run } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const source = postOf(state, params.get('postId') ?? undefined)

  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [due, setDue] = useState<string>()
  const [audience, setAudience] = useState(() => otherMemberIds(state))
  const [isPurchase, setIsPurchase] = useState(false)
  const [spec, setSpec] = useState('')
  const [qty, setQty] = useState('1')

  function submit() {
    const o = run(
      (s, ctx) =>
        R.createRequest(s, ctx, {
          sourcePostId: source?.id,
          title,
          detail,
          dueDate: due,
          audienceIds: audience,
          purchase: isPurchase ? { spec, quantity: Number(qty) } : undefined,
        }),
      '가족에게 부탁했어요',
    )
    if (o.ok) navigate(`/request/${o.id}`, { replace: true })
  }

  return (
    <>
      <TopBar title={source ? '이 글로 부탁하기' : '가족에게 부탁하기'} back />
      <main className="page form">
        {source && <SourcePostPreview post={source} s={state} link={false} />}
        <label className="field">
          <span>무엇을 부탁할까요? (필수)</span>
          <input className="input" placeholder="예: 정수기 필터 주문" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>자세한 내용 (선택)</span>
          <textarea className="input textarea" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>
        <h3 className="section">언제까지면 좋을까요?</h3>
        <DuePicker value={due} onChange={setDue} />
        <h3 className="section">누구에게 부탁할까요?</h3>
        <AudiencePicker s={state} value={audience} onChange={setAudience} />

        <label className="switch-row">
          <span>
            <b>구매가 필요한 부탁이에요</b>
            <span className="muted">켜면 제품 규격과 수량을 함께 남겨요</span>
          </span>
          <input type="checkbox" className="switch" checked={isPurchase} onChange={(e) => setIsPurchase(e.target.checked)} />
        </label>
        {isPurchase && (
          <div className="row gap8">
            <label className="field grow">
              <span>제품 규격 / 모델</span>
              <input className="input" value={spec} onChange={(e) => setSpec(e.target.value)} />
            </label>
            <label className="field qty">
              <span>수량</span>
              <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
          </div>
        )}
        <p className="hint">부탁을 올려도 담당자는 자동으로 정해지지 않아요. 가족이 직접 '제가 챙길게요'를 눌러 맡아요.</p>
      </main>
      <div className="bottom-action">
        <button className="btn btn-primary" disabled={!title.trim() || audience.length === 0} onClick={submit}>
          부탁하기
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// 부탁 상세
// ---------------------------------------------------------------------------

/**
 * 아직 맡은 사람 없음 → 제가 챙길게요 → 진행(주문했어요) → 완료(받았어요) / 취소
 * 지금 사용자가 요청자인지, 담당자인지, 그 외 가족인지에 따라 누를 수 있는 버튼이 달라진다.
 */
export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { state, run } = useStore()
  const [releasing, setReleasing] = useState(false)
  const [editing, setEditing] = useState(false)
  const r = requestOf(state, id)

  useEffect(() => {
    run((s) => R.markRequestSeen(s, id))
  }, [id, state.currentUserId, run])

  if (!r) {
    return (
      <>
        <TopBar title="부탁" back />
        <Empty>부탁을 찾을 수 없어요</Empty>
      </>
    )
  }
  const source = postOf(state, r.sourcePostId)
  const canEdit = r.requesterId === state.currentUserId && isRequestActive(r)

  return (
    <>
      <TopBar
        title={r.purchase ? '구매 부탁' : '부탁'}
        back
        actions={
          canEdit && (
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="내용 바꾸기">
              <Icon name="edit" />
            </button>
          )
        }
      />
      <main className="page detail">
        <div className="row gap8 between">
          <h2 className="detail-title">{r.title}</h2>
          <RequestBadge r={r} />
        </div>
        <StatusSteps r={r} />
        <div className="card soft facts">
          <Fact k="부탁한 사람" v={nameOf(state, r.requesterId)} />
          <Fact k="희망 시점" v={formatDue(r.dueDate)} />
          <Fact k="담당" v={r.assigneeId ? nameOf(state, r.assigneeId) : '아직 맡은 사람 없음'} />
          <Fact k="공유 대상" v={r.audienceIds.map((m) => nameOf(state, m)).join(', ')} />
          {r.purchase && (
            <>
              <Fact k="제품 규격" v={r.purchase.spec || '-'} />
              <Fact k="수량" v={`${r.purchase.quantity}개`} />
            </>
          )}
          {r.detail && <Fact k="내용" v={r.detail} />}
          {/* 확인(읽음)은 수락·주문·수령을 대신하지 않는다. */}
          <Fact k="확인한 가족" v={r.seenBy.map((m) => nameOf(state, m)).join(', ')} />
        </div>
        {source && <SourcePostPreview post={source} s={state} />}

        <RequestActions r={r} s={state} onRelease={() => setReleasing(true)} />

        {r.purchase && isRequestActive(r) && (
          <div className="card soft">
            <b>판매처 찾아보기 · 준비 중</b>
            <p className="muted">
              다음 단계에서 규격에 맞는 판매처 링크(제휴 표시)를 고를 수 있게 할 예정이에요. 지금은 평소 쓰는 쇼핑몰에서 주문하고 '주문했어요'만 눌러 주세요.
            </p>
          </div>
        )}

        <h3 className="section">처리 기록</h3>
        <ul className="timeline">
          {[...r.history].reverse().map((h, i) => (
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

      {releasing && <ReleaseDialog id={r.id} onClose={() => setReleasing(false)} />}
      {editing && <EditDialog r={r} onClose={() => setEditing(false)} />}
    </>
  )
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <div className="fact">
    <span className="muted">{k}</span>
    <span>{v}</span>
  </div>
)

function StatusSteps({ r }: { r: FamilyRequest }) {
  if (r.status === 'CANCELED') return null
  const steps = ['담당 없음', '맡음', r.purchase ? '주문' : '진행', r.purchase ? '받음' : '완료']
  const idx = { OPEN: 0, CLAIMED: 1, IN_PROGRESS: 2, DONE: 3 }[r.status]
  return (
    <ol className="steps">
      {steps.map((label, i) => (
        <li key={label} className={i <= idx ? 'done' : ''}>
          {label}
        </li>
      ))}
    </ol>
  )
}

function RequestActions({ r, s, onRelease }: { r: FamilyRequest; s: FamilyState; onRelease: () => void }) {
  const { run } = useStore()
  const me = s.currentUserId
  const isRequester = r.requesterId === me
  const isAssignee = r.assigneeId === me
  const hint = (t: string) => <p className="hint">{t}</p>

  let main: ReactNode = null
  switch (r.status) {
    case 'OPEN':
      if (!isRequester && r.audienceIds.includes(me)) {
        main = (
          <button className="btn btn-primary" onClick={() => run((st, c) => R.claimRequest(st, c, r.id), '담당으로 표시했어요')}>
            제가 챙길게요
          </button>
        )
      } else if (isRequester) main = hint('아직 맡은 사람이 없어요. 가족이 직접 맡으면 알려 드릴게요.')
      else main = hint('나에게 공유된 부탁이 아니에요.')
      break
    case 'CLAIMED':
      main = isAssignee ? (
        <>
          <button className="btn btn-primary" onClick={() => run((st, c) => R.markInProgress(st, c, r.id))}>
            {r.purchase ? '주문했어요' : '진행 중이에요'}
          </button>
          {!r.purchase && (
            <button className="btn btn-outline" onClick={() => run((st, c) => R.markDone(st, c, r.id), '완료했어요')}>
              완료했어요
            </button>
          )}
        </>
      ) : (
        hint(`${nameOf(s, r.assigneeId)}님이 맡았어요.`)
      )
      break
    case 'IN_PROGRESS':
      if (r.purchase) {
        main = isRequester ? (
          <button className="btn btn-primary" onClick={() => run((st, c) => R.markDone(st, c, r.id), '고마워요! 마무리했어요')}>
            받았어요
          </button>
        ) : (
          hint(`주문 완료. 물건을 받으면 ${nameOf(s, r.requesterId)}님이 '받았어요'로 마무리해요.`)
        )
      } else if (isAssignee || isRequester) {
        main = (
          <button className="btn btn-primary" onClick={() => run((st, c) => R.markDone(st, c, r.id), '완료했어요')}>
            완료했어요
          </button>
        )
      } else main = hint(`${nameOf(s, r.assigneeId)}님이 진행 중이에요.`)
      break
    case 'DONE':
      main = hint('마무리된 부탁이에요. 고마워요!')
      break
    case 'CANCELED':
      main = hint('취소된 부탁이에요.')
      break
  }

  return (
    <div className="actions">
      {main}
      {isAssignee && (r.status === 'CLAIMED' || r.status === 'IN_PROGRESS') && (
        <button className="btn btn-text" onClick={onRelease}>
          더는 처리하기 어려워요 (맡기 취소)
        </button>
      )}
      {isRequester && isRequestActive(r) && (
        <button
          className="btn btn-text danger"
          onClick={() => confirm('이 부탁을 취소할까요?') && run((st, c) => R.cancelRequest(st, c, r.id), '부탁을 취소했어요')}
        >
          부탁 취소하기
        </button>
      )}
    </div>
  )
}

function ReleaseDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { run } = useStore()
  const [reason, setReason] = useState('')
  return (
    <Modal
      title="맡기 취소"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button
            className="btn btn-primary"
            onClick={() => run((s, c) => R.releaseRequest(s, c, id, reason), '맡기를 취소했어요').ok && onClose()}
          >
            맡기 취소
          </button>
        </>
      }
    >
      <p>부탁한 가족에게 알리고, 다시 '담당 없음'으로 돌아가요.</p>
      <input className="input" placeholder="짧은 사유 (선택)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </Modal>
  )
}

function EditDialog({ r, onClose }: { r: FamilyRequest; onClose: () => void }) {
  const { run } = useStore()
  const [detail, setDetail] = useState(r.detail)
  const [due, setDue] = useState(r.dueDate)
  const [spec, setSpec] = useState(r.purchase?.spec ?? '')
  const [qty, setQty] = useState(String(r.purchase?.quantity ?? 1))
  return (
    <Modal
      title="부탁 내용 바꾸기"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              run(
                (s, c) =>
                  R.updateRequest(s, c, r.id, {
                    detail,
                    dueDate: due,
                    purchase: r.purchase ? { spec, quantity: Number(qty) } : undefined,
                  }),
                r.assigneeId ? '내용을 바꾸고 담당자에게 알렸어요' : '내용을 바꿨어요',
              ).ok && onClose()
            }
          >
            저장
          </button>
        </>
      }
    >
      <p className="muted">전화로 바뀐 내용도 여기서 고쳐 주세요. 담당자에게 알림이 가요.</p>
      <label className="field">
        <span>내용</span>
        <textarea className="input textarea" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </label>
      <span className="label">희망 시점: {formatDue(due)}</span>
      <DuePicker value={due} onChange={setDue} />
      {r.purchase && (
        <div className="row gap8">
          <label className="field grow">
            <span>제품 규격</span>
            <input className="input" value={spec} onChange={(e) => setSpec(e.target.value)} />
          </label>
          <label className="field qty">
            <span>수량</span>
            <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
        </div>
      )}
    </Modal>
  )
}
