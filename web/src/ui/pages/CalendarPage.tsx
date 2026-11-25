import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eventsOnDay } from '../../domain/calendar'
import { formatDate, formatDue, todayKey } from '../../domain/dates'
import { cardOf, describeTime, nameOf } from '../../domain/models'
import { useStore } from '../../store/store'
import { RequestBadge, ScheduleBadge, TopBar } from '../components/common'
import { MonthCalendar } from '../components/MonthCalendar'

/** 달력: 날짜마다 일정·부탁 기한·자동화를 점으로 보여주고, 날짜를 누르면 그날 목록 */
export function CalendarPage() {
  const { state } = useStore()
  const today = todayKey()
  const [selected, setSelected] = useState(today)
  const day = eventsOnDay(state, selected)
  const empty = day.schedules.length + day.requests.length + day.routines.length === 0

  return (
    <>
      <TopBar title="달력" />
      <main className="page detail">
        <MonthCalendar s={state} selected={selected} onSelect={setSelected} />

        <h3 className="section">{selected === today ? `오늘 · ${formatDate(selected)}` : formatDate(selected)}</h3>
        {empty && <p className="hint">이 날은 아직 아무것도 없어요.</p>}
        {day.schedules.map((p) => (
          <Link key={p.id} to={`/schedule/${p.id}`} className="cal-item">
            <span className="cal-item-time">{describeTime(p.startAt.slice(11, 16))}</span>
            <span className="grow">
              📅 <b>{p.title}</b>
              <span className="muted small"> · {nameOf(state, p.proposerId)} 제안</span>
            </span>
            <ScheduleBadge p={p} />
          </Link>
        ))}
        {day.requests.map((r) => (
          <Link key={r.id} to={`/request/${r.id}`} className="cal-item">
            <span className="cal-item-time">{formatDue(r.dueDate)}</span>
            <span className="grow">
              {r.purchase ? '🛒' : '🙏'} <b>{r.title}</b>
            </span>
            <RequestBadge r={r} />
          </Link>
        ))}
        {day.routines.map(({ routine, times }) => (
          <Link key={routine.id} to="/routines" className="cal-item cal-item-routine">
            <span className="cal-item-time">{times.map(describeTime).join(', ')}</span>
            <span className="grow">
              ⏰ {routine.card && `${cardOf(routine.card)?.emoji} `}
              {routine.text}
              <span className="muted small"> → {routine.targetIds.map((t) => nameOf(state, t)).join('·')}</span>
            </span>
          </Link>
        ))}
        <Link to={`/schedule/new?date=${selected}`} className="btn btn-tonal">
          + 이 날 일정 제안하기
        </Link>
      </main>
    </>
  )
}
