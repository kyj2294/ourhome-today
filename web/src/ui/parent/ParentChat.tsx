import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { upcomingSchedules } from '../../domain/calendar'
import { formatDate, formatDateTime, todayKey, toLocalDateTime } from '../../domain/dates'
import { type FamilyState, type Post, describeTime, memberOf, nameOf } from '../../domain/models'
import * as R from '../../domain/rules'
import { compressImage } from '../../store/images'
import { useStore } from '../../store/store'
import { CallButton } from '../components/call'
import { Avatar, Photo } from '../components/common'
import { ParentQuestionAsk } from '../components/questions'
import { MyRequest, RequestAsk, ScheduleAsk } from './ParentPages'

/*
 * 부모님 화면 — 카톡 가족 단톡방처럼
 * 가족이 올린 사진·글·카드·질문이 말풍선으로 흘러가고, 질문 말풍선 안에서 큰 버튼으로 바로 답한다.
 * 아래에는 [📷 사진] [메시지] [보내기] 와 [🙏 부탁]만 있다.
 */

interface ChatItem {
  at: string
  key: string
  from: string
  node: ReactNode
  /** 말풍선이 아니라 넓은 카드(질문·일정·부탁) */
  wide?: boolean
}

const timeOf = (iso: string) => describeTime(toLocalDateTime(new Date(iso)).slice(11, 16))
const dayOf = (iso: string) => toLocalDateTime(new Date(iso)).slice(0, 10)

function buildItems(s: FamilyState): ChatItem[] {
  const me = s.currentUserId
  const today = todayKey()
  const items: ChatItem[] = []
  for (const p of s.posts) items.push({ at: p.createdAt, key: `p-${p.id}`, from: p.authorId, node: <PostBubble post={p} s={s} /> })
  for (const q of s.questions) {
    if (q.targetIds.includes(me)) items.push({ at: q.createdAt, key: `q-${q.id}`, from: q.askerId, node: <ParentQuestionAsk q={q} s={s} />, wide: true })
  }
  for (const p of s.schedules) {
    if (!p.canceled && p.audienceIds.includes(me) && p.startAt.slice(0, 10) >= today)
      items.push({ at: p.createdAt, key: `s-${p.id}`, from: p.proposerId, node: <ScheduleAsk p={p} s={s} />, wide: true })
  }
  for (const r of s.requests) {
    const toMe = r.requesterId !== me && r.audienceIds.includes(me) && (r.status === 'OPEN' || (r.assigneeId === me && (r.status === 'CLAIMED' || r.status === 'IN_PROGRESS')))
    if (toMe) items.push({ at: r.createdAt, key: `r-${r.id}`, from: r.requesterId, node: <RequestAsk r={r} s={s} />, wide: true })
    if (r.requesterId === me && r.status !== 'CANCELED') items.push({ at: r.createdAt, key: `m-${r.id}`, from: me, node: <MyRequest r={r} s={s} />, wide: true })
  }
  return items.sort((a, b) => a.at.localeCompare(b.at))
}

export function ParentChat() {
  const { state, run, uploadImage, signOut, toast } = useStore()
  const navigate = useNavigate()
  const me = state.currentUserId
  const [text, setText] = useState('')
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const items = buildItems(state)
  const next = upcomingSchedules(state, todayKey())[0]
  const family = state.members.filter((m) => m.id !== me)

  // 처음 열 때와 새 말풍선이 생길 때 맨 아래로
  const count = items.length
  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [count])

  function sendText() {
    if (!text.trim()) return
    if (run((s, c) => R.createPost(s, c, text, [])).ok) setText('')
  }

  async function sendPhotos(files: FileList | null) {
    if (!files?.length) return
    setSendingPhoto(true)
    try {
      const urls = await Promise.all(
        Array.from(files)
          .filter((f) => f.type.startsWith('image/'))
          .slice(0, 5)
          .map((f) => compressImage(f).then(uploadImage)),
      )
      if (run((s, c) => R.createPost(s, c, text, urls), '가족에게 사진을 보냈어요').ok) setText('')
    } catch {
      toast('사진을 보내지 못했어요. 다시 해 주세요.')
    } finally {
      setSendingPhoto(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  let lastDay = ''
  return (
    <div className="chat">
      <header className="chat-head">
        <div className="chat-title">
          <b>우리집 가족방</b>
          <button className="chat-out" onClick={() => confirm('다른 사람으로 바꿀까요?') && signOut()}>
            {nameOf(state, me)} · 바꾸기
          </button>
        </div>
        <div className="chat-calls">
          {family.map((m) => (
            <CallButton key={m.id} memberId={m.id} label={m.name} className="chat-call" />
          ))}
        </div>
        {next && (
          <div className="chat-pin">
            📅 {formatDateTime(next.startAt)} · <b>{next.title}</b> {next.confirmed ? '(정해졌어요)' : ''}
          </div>
        )}
      </header>

      <main className="chat-list">
        {items.map((it) => {
          const day = dayOf(it.at)
          const sep = day !== lastDay ? <div className="chat-day">{formatDate(day)}</div> : null
          lastDay = day
          const mine = it.from === me
          const sender = memberOf(state, it.from)
          return (
            <div key={it.key}>
              {sep}
              <div className={`msg ${mine ? 'msg-me' : 'msg-other'} ${it.wide ? 'msg-wide' : ''}`}>
                {!mine && <Avatar member={sender} size={44} />}
                <div className="msg-body">
                  {!mine && <div className="msg-name">{sender?.name}</div>}
                  {it.node}
                  <div className="msg-time">{timeOf(it.at)}</div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </main>

      <footer className="chat-composer">
        <button className="chat-btn chat-photo" onClick={() => fileInput.current?.click()} disabled={sendingPhoto} aria-label="사진 보내기">
          {sendingPhoto ? '…' : '📷'}
        </button>
        <textarea
          className="chat-input"
          rows={1}
          value={text}
          placeholder={sendingPhoto ? '사진 보내는 중…' : '메시지 쓰기'}
          onChange={(e) => setText(e.target.value)}
        />
        {text.trim() ? (
          <button className="chat-btn chat-send" onClick={sendText}>
            보내기
          </button>
        ) : (
          <button className="chat-btn chat-ask" onClick={() => navigate('/request/new')}>
            🙏 부탁
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => sendPhotos(e.target.files)} />
      </footer>
    </div>
  )
}

/** 사진·글 말풍선. 누르면 크게 보기 + 댓글 */
function PostBubble({ post, s }: { post: Post; s: FamilyState }) {
  return (
    <Link to={`/post/${post.id}`} className="bubble-post">
      {post.photos.length > 0 && (
        <div className={`bubble-photos n${Math.min(post.photos.length, 3)}`}>
          {post.photos.slice(0, 3).map((ph, i) => (
            <Photo key={i} src={ph} className="bubble-photo" />
          ))}
        </div>
      )}
      {post.text && <p className="bubble-text">{post.text}</p>}
      {post.comments.length > 0 && (
        <span className="bubble-comments">
          💬 {post.comments.length} · {nameOf(s, post.comments[post.comments.length - 1].authorId)}: {post.comments[post.comments.length - 1].text.slice(0, 20)}
        </span>
      )}
    </Link>
  )
}
