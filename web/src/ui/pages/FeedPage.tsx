import { Link } from 'react-router-dom'
import { formatRelative } from '../../domain/dates'
import { type FamilyState, type Post, memberOf, nameOf, requestOf, scheduleOf } from '../../domain/models'
import { useStore } from '../../store/store'
import { Avatar, PhotoStrip, RequestCard, ScheduleCard, TopBar } from '../components/common'
import { Icon } from '../components/icons'
import { AskParentsCard, MyQuestions } from '../components/questions'

/**
 * 가족 소식 (첫 화면)
 * 사진·짧은 글이 중심이다. 부탁·일정이 연결된 글만 연결 항목의 '최신 상태'를 함께 보여준다.
 */
export function FeedPage() {
  const { state } = useStore()
  const posts = [...state.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <TopBar title="우리집 오늘" subtitle={`${state.familyName} · ${nameOf(state, state.currentUserId)}(으)로 보는 중`} />
      <main className="page list">
        <AskParentsCard />
        <MyQuestions s={state} />
        {posts.map((p) => (
          <PostCard key={p.id} post={p} s={state} />
        ))}
        {posts.length === 0 && <div className="empty">첫 소식을 올려 보세요</div>}
      </main>
      <Link to="/compose" className="fab">
        <Icon name="plus" /> 소식 올리기
      </Link>
    </>
  )
}

export function PostCard({ post, s }: { post: Post; s: FamilyState }) {
  const linkedRequest = requestOf(s, post.linkedRequestId)
  const linkedPlan = scheduleOf(s, post.linkedScheduleId)
  return (
    <article className="card post-card">
      <Link to={`/post/${post.id}`} className="row gap10">
        <Avatar member={memberOf(s, post.authorId)} />
        <div>
          <div className="name">{nameOf(s, post.authorId)}</div>
          <div className="muted small">{formatRelative(post.createdAt)}</div>
        </div>
      </Link>
      <PhotoStrip photos={post.photos} />
      {post.text && (
        <Link to={`/post/${post.id}`} className="post-text clamp6">
          {post.text}
        </Link>
      )}
      {/* 원글과 연결된 부탁/일정: 담당·상태가 바뀌면 여기서도 같은 최신 정보를 보여준다. */}
      {linkedRequest && <RequestCard r={linkedRequest} s={s} />}
      {linkedPlan && <ScheduleCard p={linkedPlan} s={s} />}
      {/* 읽음은 의사 표현·담당과 별개로 조용히 표시한다. */}
      <Link to={`/post/${post.id}`} className="muted small">
        읽음 {post.readBy.length}명{post.comments.length > 0 && ` · 댓글 ${post.comments.length}`}
      </Link>
    </article>
  )
}
