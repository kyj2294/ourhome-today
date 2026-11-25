import { useState } from 'react'
import { eventsOnDay, monthMatrix } from '../../domain/calendar'
import { parseLocal, todayKey } from '../../domain/dates'
import type { FamilyState } from '../../domain/models'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 한 달 달력 (자녀 달력 탭, 부모님 단톡방 위 펼침 달력이 함께 쓴다)
 * - 날짜마다 일정·부탁 기한·자동화를 점으로 표시
 * - simple: 부모님용 — 일정 점만, 크게, 범례 단순
 */
export function MonthCalendar({
  s,
  selected,
  onSelect,
  simple = false,
}: {
  s: FamilyState
  selected: string
  onSelect: (dateKey: string) => void
  simple?: boolean
}) {
  const today = todayKey()
  const [ym, setYm] = useState(() => {
    const d = parseLocal(selected)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const weeks = monthMatrix(ym.y, ym.m)
  const move = (delta: number) => setYm(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }))

  return (
    <div className={`month-cal ${simple ? 'month-cal-simple' : ''}`}>
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
            onSelect(today)
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
          const ev = eventsOnDay(s, key)
          const other = d.getMonth() !== ym.m
          return (
            <button
              key={key}
              className={`cal-day ${other ? 'other' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'selected' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}`}
              onClick={() => onSelect(key)}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일`}
            >
              <span className="cal-num">{d.getDate()}</span>
              <span className="cal-dots">
                {ev.schedules.length > 0 && <i className="dot-schedule" />}
                {ev.requests.length > 0 && <i className="dot-request" />}
                {!simple && ev.routines.length > 0 && <i className="dot-routine" />}
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
          <i className="dot-request" /> {simple ? '부탁' : '부탁 기한'}
        </span>
        {!simple && (
          <span>
            <i className="dot-routine" /> 자동화
          </span>
        )}
      </div>
    </div>
  )
}
