import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatRelative } from '../../domain/dates'
import { memberOf, nameOf, postOf, requestOf, scheduleOf } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { Avatar, Empty, PhotoStrip, RequestCard, ScheduleCard, TopBar } from '../components/common'
import { Icon } from '../components/icons'

export function PostDetailPage() {
  const { id = '' } = useParams()
  const { state, run } = useStore()
  const navigate = useNavigate()
  const [comment, setComment] = useState('')
  const post = postOf(state, id)

  // 들어오면 읽음 처리 (읽음은 의사 표현이 아니다)
  useEffect(() => {
    run((s) => R.markPostRead(s, id))
  }, [id, state.currentUserId, run])

  if (!post) {
    return (
      <>
        <TopBar title="가족 소식" back />
        <Empty>게시물을 찾을 수 없어요</Empty>
      </>
    )
  }

  const isMine = post.authorId === state.currentUserId
  const request = requestOf(state, post.linkedRequestId)
  const plan = scheduleOf(state, post.linkedScheduleId)

  function send() {
    const o = run((s, ctx) => R.addComment(s, ctx, id, comment))
    if (o.ok) setComment('')
  }

  return (
    <>
      <TopBar
        title="가족 소식"
        back
        actions={
          isMine && (
            <button
              className="icon-btn"
              aria-label="글 지우기"
              onClick={() => {
                if (confirm('이 글을 지울까요?') && run((s) => R.deletePost(s, id), '글을 지웠어요').ok) navigate('/', { replace: true })
              }}
            >
              <Icon name="trash" />
            </button>
          )
        }
      />
      <main className="page detail">
        <div className="row gap10">
          <Avatar member={memberOf(state, post.authorId)} />
          <div>
            <div className="name">{nameOf(state, post.authorId)}</div>
            <div className="muted small">{formatRelative(post.createdAt)}</div>
          </div>
        </div>
        <PhotoStrip photos={post.photos} />
        {post.text && <p className="post-text">{post.text}</p>}

        {request && <RequestCard r={request} s={state} />}
        {plan && <ScheduleCard p={plan} s={state} />}
        {!request && !plan && isMine && (
          <div className="card soft">
            <p className="muted">필요하면 이 글의 사진·설명 그대로 가족에게 부탁하거나 일정을 제안할 수 있어요.</p>
            <div className="row gap8">
              <Link className="btn btn-outline grow" to={`/request/new?postId=${post.id}`}>
                🙏 가족에게 부탁
              </Link>
              <Link className="btn btn-outline grow" to={`/schedule/new?postId=${post.id}`}>
                📅 일정 제안
              </Link>
            </div>
          </div>
        )}

        <p className="muted small">읽은 가족: {post.readBy.map((m) => nameOf(state, m)).join(', ')}</p>
        <hr />
        <h3 className="section">댓글 {post.comments.length}</h3>
        {post.comments.map((c) => (
          <div key={c.id} className="row gap10 top comment">
            <Avatar member={memberOf(state, c.authorId)} size={32} />
            <div>
              <div className="label">
                {nameOf(state, c.authorId)} · {formatRelative(c.createdAt)}
              </div>
              <div>{c.text}</div>
            </div>
          </div>
        ))}
      </main>
      <form
        className="comment-bar"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input className="input" placeholder="댓글 남기기" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="icon-btn primary" type="submit" aria-label="보내기" disabled={!comment.trim()}>
          <Icon name="send" />
        </button>
      </form>
    </>
  )
}
