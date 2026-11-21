import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDateTime, formatDue, formatRelative } from '../../domain/dates'
import {
  type FamilyRequest,
  type FamilyState,
  type Member,
  type Post,
  type SchedulePlan,
  currentResponse,
  memberOf,
  nameOf,
  needsReconfirm,
  requestStatusLabel,
  scheduleStatusLabel,
  unreadCount,
} from '../../domain/models'
import { useStore } from '../../store/store'
import { Icon } from './icons'

export function Avatar({ member, size = 40 }: { member?: Member; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: member?.color ?? '#9e9e9e', fontSize: size * 0.42 }}
      aria-hidden
    >
      {member?.name.slice(0, 1) ?? '?'}
    </span>
  )
}

/** 사진 한 장. "sample:" 값은 시연용 자리표시로 그린다. */
export function Photo({ src, className = '', onClick }: { src: string; className?: string; onClick?: () => void }) {
  if (src.startsWith('sample:')) {
    return (
      <div className={`photo photo-sample ${className}`} onClick={onClick}>
        <span>📷</span>
        <span>{src.slice(7)}</span>
      </div>
    )
  }
  return <img className={`photo ${className}`} src={src} alt="가족 사진" loading="lazy" onClick={onClick} />
}

/** 게시물 사진들: 한 장이면 크게, 여러 장이면 가로로 넘겨 보기. 누르면 크게 보기 */
export function PhotoStrip({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (photos.length === 0) return null
  return (
    <>
      {photos.length === 1 ? (
        <Photo src={photos[0]} className="photo-single" onClick={() => setOpen(photos[0])} />
      ) : (
        <div className="photo-strip">
          {photos.map((p, i) => (
            <Photo key={i} src={p} className="photo-square" onClick={() => setOpen(p)} />
          ))}
        </div>
      )}
      {open && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <Photo src={open} className="photo-full" />
        </div>
      )}
    </>
  )
}

type Tone = 'yellow' | 'orange' | 'green' | 'gray' | 'red'
export const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={`badge badge-${tone}`}>{children}</span>
)

export function RequestBadge({ r }: { r: FamilyRequest }) {
  const tone: Tone =
    r.status === 'OPEN' ? 'yellow' : r.status === 'DONE' ? 'green' : r.status === 'CANCELED' ? 'gray' : 'orange'
  return <Badge tone={tone}>{requestStatusLabel(r)}</Badge>
}

export function ScheduleBadge({ p }: { p: SchedulePlan }) {
  return <Badge tone={p.canceled ? 'gray' : p.confirmed ? 'green' : 'yellow'}>{scheduleStatusLabel(p)}</Badge>
}

/**
 * 부탁 카드. 기획서 예시: "정수기 필터 부탁 | 다음 주까지 | 민수가 맡음 | 주문했어요"
 * 제목·희망 시점·담당·현재 상태를 목록에서 바로 읽게 한다.
 */
export function RequestCard({ r, s }: { r: FamilyRequest; s: FamilyState }) {
  const assignee = r.assigneeId ? `${nameOf(s, r.assigneeId)}님이 맡음` : '담당 없음'
  return (
    <Link to={`/request/${r.id}`} className="item-card">
      <span className="item-icon">{r.purchase ? '🛒' : '🙏'}</span>
      <span className="item-body">
        <span className="item-kind">{r.purchase ? '구매 부탁' : '부탁'}</span>
        <span className="item-title">{r.title}</span>
        <span className="item-sub">
          {nameOf(s, r.requesterId)}님 · {formatDue(r.dueDate)} · {assignee}
        </span>
      </span>
      <RequestBadge r={r} />
    </Link>
  )
}

export function ScheduleCard({ p, s }: { p: SchedulePlan; s: FamilyState }) {
  const me = s.currentUserId
  const available = p.audienceIds.filter((id) => currentResponse(p, id)?.availability === 'AVAILABLE').length
  const waiting = p.audienceIds.filter((id) => !currentResponse(p, id)).length
  const kind = needsReconfirm(p, me)
    ? '일정 · 시간이 바뀌어 다시 확인해 주세요'
    : p.audienceIds.includes(me) && !currentResponse(p, me) && !p.canceled
      ? '일정 · 내 응답 필요'
      : '일정'
  return (
    <Link to={`/schedule/${p.id}`} className="item-card">
      <span className="item-icon">📅</span>
      <span className="item-body">
        <span className={`item-kind ${kind !== '일정' ? 'item-kind-alert' : ''}`}>{kind}</span>
        <span className="item-title">{p.title}</span>
        <span className="item-sub">
          {formatDateTime(p.startAt)} · 가능 {available}명 · {waiting > 0 ? `응답 대기 ${waiting}명` : '모두 응답'}
        </span>
      </span>
      <ScheduleBadge p={p} />
    </Link>
  )
}

/** 원글 미리보기 (부탁·일정 상세에서 원래 사진과 글을 다시 보여준다) */
export function SourcePostPreview({ post, s, link = true }: { post: Post; s: FamilyState; link?: boolean }) {
  const body = (
    <>
      <div className="row gap8">
        <Avatar member={memberOf(s, post.authorId)} size={26} />
        <span className="label">
          원글 · {nameOf(s, post.authorId)} · {formatRelative(post.createdAt)}
        </span>
      </div>
      {post.photos[0] && <Photo src={post.photos[0]} className="photo-wide" />}
      {post.text && <p className="clamp3">{post.text}</p>}
    </>
  )
  return link ? (
    <Link to={`/post/${post.id}`} className="card source-card">
      {body}
    </Link>
  ) : (
    <div className="card source-card">{body}</div>
  )
}

/** 공유 대상(가족) 고르기 */
export function AudiencePicker({ s, value, onChange }: { s: FamilyState; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {s.members
        .filter((m) => m.id !== s.currentUserId)
        .map((m) => {
          const on = value.includes(m.id)
          return (
            <button
              type="button"
              key={m.id}
              className={`chip ${on ? 'chip-on' : ''}`}
              onClick={() => onChange(on ? value.filter((v) => v !== m.id) : [...value, m.id])}
            >
              <Avatar member={m} size={20} /> {m.name}
            </button>
          )
        })}
    </div>
  )
}

/** 상단 바. back=true면 뒤로가기, 아니면 알림 종 */
export function TopBar({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: boolean; actions?: ReactNode }) {
  const navigate = useNavigate()
  const { state } = useStore()
  const unread = unreadCount(state)
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="뒤로">
          <Icon name="back" />
        </button>
      )}
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
      {actions}
      {!back && (
        <Link to="/notifications" className="icon-btn bell" aria-label="알림">
          <Icon name="bell" />
          {unread > 0 && <span className="dot">{unread}</span>}
        </Link>
      )}
    </header>
  )
}

/** 간단한 대화상자 */
export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>
