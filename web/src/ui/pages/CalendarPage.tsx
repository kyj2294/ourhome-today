import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eventsOnDay, monthMatrix } from '../../domain/calendar'
import { formatDate, formatDue, parseLocal, todayKey } from '../../domain/dates'
import { cardOf, describeTime, nameOf } from '../../domain/models'
import { useStore } from '../../store/store'
import { RequestBadge, ScheduleBadge, TopBar } from '../components/common'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 달력: 날짜마다 일정·부탁 기한·자동화를 점으로 보여주고, 날짜를 누르면 그날 목록 */
export function CalendarPage() {
  const { state } = useStore()
  const today = todayKey()
  const [selected, setSelected] = useState(today)
  const [ym, setYm] = useState(() => {
    const d = parseLocal(today)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const weeks = monthMatrix(ym.y, ym.m)
  const move = (delta: number) => setYm(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }))
  const day = eventsOnDay(state, selected)
  const empty = day.schedules.length + day.requests.length + day.routines.length === 0

  return (
    <>
      <TopBar title="달력" />
      <main className="page detail">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="이전 달">
            ‹
          </button>
          <b>
            {ym.y}년 {ym.m + 1}월
          </b>
          <button className="icon-btn" onClick={() => move(1)} aria-label="다음 달">
            ›
          </button>
          <button
            className="chip cal-today"
            onClick={() => {
              const d = parseLocal(today)
              setYm({ y: d.getFullYear(), m: d.getMonth() })
              setSelected(today)
            }}
          >
            오늘
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {WEEK.map((w, i) => (
            <div key={w} className={`cal-week ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
              {w}
            </div>
          ))}
          {weeks.flat().map((key) => {
            const d = parseLocal(key)
            const ev = eventsOnDay(state, key)
            const other = d.getMonth() !== ym.m
            return (
              <button
                key={key}
                className={`cal-day ${other ? 'other' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'selected' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}`}
                onClick={() => setSelected(key)}
                aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일`}
              >
                <span className="cal-num">{d.getDate()}</span>
                <span className="cal-dots">
                  {ev.schedules.length > 0 && <i className="dot-schedule" />}
                  {ev.requests.length > 0 && <i className="dot-request" />}
                  {ev.routines.length > 0 && <i className="dot-routine" />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="cal-legend">
          <span>
            <i className="dot-schedule" /> 일정
          </span>
          <span>
            <i className="dot-request" /> 부탁 기한
          </span>
          <span>
            <i className="dot-routine" /> 자동화
          </span>
        </div>

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
