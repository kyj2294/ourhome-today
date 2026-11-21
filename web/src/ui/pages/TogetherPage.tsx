import { useState } from 'react'
import { Link } from 'react-router-dom'
import { todayKey } from '../../domain/dates'
import { TOGETHER_FILTERS, type TogetherFilter, togetherItems } from '../../domain/together'
import { useStore } from '../../store/store'
import { Empty, RequestCard, ScheduleCard, TopBar } from '../components/common'

const EMPTY: Record<TogetherFilter, string> = {
  TODAY: '오늘 챙길 일정이나 부탁이 없어요',
  AWAITING: '내가 응답할 항목이 없어요',
  IN_PROGRESS: '진행 중인 일이 없어요',
  ALL: '아직 함께할 일이 없어요. 소식을 올리다가 필요할 때 부탁이나 일정으로 연결해 보세요.',
}

/** 오늘 함께할 일: 일정과 부탁을 '응답 대기 · 오늘 · 진행 중'으로 찾는다. */
export function TogetherPage() {
  const { state } = useStore()
  const [filter, setFilter] = useState<TogetherFilter>(() => (sessionStorage.getItem('together-filter') as TogetherFilter) || 'AWAITING')
  const choose = (f: TogetherFilter) => {
    setFilter(f)
    sessionStorage.setItem('together-filter', f)
  }
  const items = togetherItems(state, filter, todayKey())
  const counts = Object.fromEntries(TOGETHER_FILTERS.map((f) => [f.key, togetherItems(state, f.key, todayKey()).length]))

  return (
    <>
      <TopBar title="오늘 함께할 일" />
      <div className="chips filter-bar">
        {TOGETHER_FILTERS.map((f) => (
          <button key={f.key} className={`chip ${filter === f.key ? 'chip-on' : ''}`} onClick={() => choose(f.key)}>
            {f.label} {counts[f.key] > 0 && <b>{counts[f.key]}</b>}
          </button>
        ))}
      </div>
      <main className="page list">
        {items.map((i) =>
          i.kind === 'request' ? <RequestCard key={i.request.id} r={i.request} s={state} /> : <ScheduleCard key={i.plan.id} p={i.plan} s={state} />,
        )}
        {items.length === 0 && <Empty>{EMPTY[filter]}</Empty>}
        <div className="row gap8 new-actions">
          <Link to="/request/new" className="btn btn-tonal grow">
            🙏 가족에게 부탁하기
          </Link>
          <Link to="/schedule/new" className="btn btn-tonal grow">
            📅 일정 제안하기
          </Link>
        </div>
      </main>
    </>
  )
}
