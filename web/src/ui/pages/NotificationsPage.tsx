import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRelative } from '../../domain/dates'
import { type AppNotification, myNotifications } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { Empty, TopBar } from '../components/common'

const hrefOf = (n: AppNotification) => (n.target.kind === 'question' ? '/' : `/${n.target.kind}/${n.target.id}`)

/**
 * 알림 목록. 응답을 요청받았거나 맡은 일에 관련된 변경만 온다.
 * 미접속·미응답을 위험 신호로 해석하는 '자동 안부 경고'는 만들지 않는다.
 */
export function NotificationsPage() {
  const { state, run } = useStore()
  // 들어온 순간의 목록(안 읽음 표시 포함)을 고정해 두고, 바로 읽음 처리한다.
  const [list, setList] = useState(() => myNotifications(state))
  useEffect(() => {
    setList(myNotifications(state))
    run((s) => R.markMyNotificationsRead(s))
  }, [state.currentUserId, run])

  return (
    <>
      <TopBar title="알림" back />
      <main className="page">
        {list.length === 0 && <Empty>새 알림이 없어요</Empty>}
        <ul className="notifications">
          {list.map((n) => (
            <li key={n.id}>
              <Link to={hrefOf(n)} className={n.read ? '' : 'unread'}>
                <span className="dot-small" />
                <span>
                  <div>{n.message}</div>
                  <div className="muted small">{formatRelative(n.at)}</div>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
