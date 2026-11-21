/** 날짜 도우미. 외부 라이브러리 없이 한국어 표기를 만든다. */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' (로컬 기준) */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Date → 'YYYY-MM-DDTHH:mm' (로컬 기준, <input type="datetime-local"> 형식) */
export const toLocalDateTime = (d: Date) => `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export const todayKey = (now: Date = new Date()) => toDateKey(now)

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return toDateKey(new Date(y, m - 1, d + days))
}

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm' → 로컬 Date */
export function parseLocal(value: string): Date {
  const [date, time = '00:00'] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

/** '11월 21일 (토)' */
export function formatDate(dateKey: string): string {
  const d = parseLocal(dateKey)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

/** '11월 22일 (토) 오전 10:00' */
export function formatDateTime(local: string): string {
  const d = parseLocal(local)
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${formatDate(local.split('T')[0])} ${ampm} ${h12}:${pad(d.getMinutes())}`
}

/** '방금', '5분 전', '3시간 전', '어제', '11월 18일 (수)' */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  if (toDateKey(at) === addDays(toDateKey(now), -1)) return '어제'
  return formatDate(toDateKey(at))
}

/** 부탁 희망 시점 표기: '기한 없음', '오늘까지', '내일까지', '11월 25일 (화)까지' */
export function formatDue(dateKey: string | undefined, today: string = todayKey()): string {
  if (!dateKey) return '기한 없음'
  if (dateKey < today) return `${formatDate(dateKey)}까지 (지남)`
  if (dateKey === today) return '오늘까지'
  if (dateKey === addDays(today, 1)) return '내일까지'
  return `${formatDate(dateKey)}까지`
}
