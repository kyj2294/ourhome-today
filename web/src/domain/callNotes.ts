/**
 * 통화 메모 → 일정·부탁 제안
 *
 * 통화가 끝난 뒤 사용자가 말하거나 적은 한두 문장에서 날짜·시간·부탁을 찾아 "제안"으로 돌려준다.
 * 자동으로 등록하지 않는다 — 화면에서 사용자가 확인하고 고친 뒤 추가한다.
 *
 * 지금은 기기 안에서 규칙으로만 처리한다(서버·AI 없음).
 * 나중에 AI(예: Claude API)로 바꿀 때도 이 함수의 입력·출력 형태만 지키면 화면은 그대로 쓸 수 있다.
 */
import { toDateKey, toLocalDateTime } from './dates'

export interface CallSuggestion {
  kind: 'schedule' | 'request'
  title: string
  /** 일정일 때 'YYYY-MM-DDTHH:mm' */
  startAt?: string
  /** 사야 하는 물건 부탁인지 */
  purchase?: boolean
  /** 원래 문장 (화면에 근거로 보여준다) */
  source: string
}

const WEEKDAY: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

const DATE_PATTERNS = [
  /(이번\s?주|다음\s?주|담주)?\s*([월화수목금토일])요일/,
  /(\d{1,2})월\s*(\d{1,2})일/,
  /(\d{1,2})일(?!\s*(?:동안|간))/,
  /(오늘|내일|낼|모레|글피|이번\s?주말|다음\s?주말|주말)/,
]
const TIME_PATTERN = /(오전|오후|아침|점심|저녁|밤|새벽)?\s*(\d{1,2})\s*시(?:\s*(반)|\s*(\d{1,2})\s*분)?/
const PART_OF_DAY = /(아침|점심|저녁)/

/** 문장에서 날짜를 찾는다. 없으면 null */
export function findDate(text: string, now: Date): Date | null {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const addDays = (n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n)

  let m = text.match(DATE_PATTERNS[0])
  if (m) {
    const target = WEEKDAY[m[2]]
    const prefix = (m[1] ?? '').replace(/\s/g, '')
    let diff = (target - base.getDay() + 7) % 7
    if (prefix === '다음주' || prefix === '담주') {
      // 다음 주의 그 요일 (월요일 시작 기준)
      const toNextMonday = ((8 - base.getDay()) % 7) || 7
      diff = toNextMonday + ((target + 6) % 7)
    } else if (prefix === '이번주' && diff === 0) {
      diff = 0
    }
    return addDays(diff)
  }
  m = text.match(DATE_PATTERNS[1])
  if (m) {
    let d = new Date(base.getFullYear(), Number(m[1]) - 1, Number(m[2]))
    if (d < base) d = new Date(base.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]))
    return d
  }
  m = text.match(DATE_PATTERNS[3])
  if (m) {
    const w = m[1].replace(/\s/g, '')
    if (w === '오늘') return addDays(0)
    if (w === '내일' || w === '낼') return addDays(1)
    if (w === '모레') return addDays(2)
    if (w === '글피') return addDays(3)
    const toSat = (6 - base.getDay() + 7) % 7
    if (w === '다음주말') return addDays(toSat + 7)
    return addDays(toSat)
  }
  m = text.match(DATE_PATTERNS[2])
  if (m) {
    const day = Number(m[1])
    if (day >= 1 && day <= 31) {
      let d = new Date(base.getFullYear(), base.getMonth(), day)
      if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, day)
      return d
    }
  }
  return null
}

/** 문장에서 시각을 찾는다. [시, 분] 또는 null */
export function findTime(text: string): [number, number] | null {
  const m = text.match(TIME_PATTERN)
  if (m) {
    let h = Number(m[2])
    const min = m[3] ? 30 : m[4] ? Number(m[4]) : 0
    const part = m[1]
    if ((part === '오후' || part === '저녁' || part === '밤') && h < 12) h += 12
    if (part === '점심' && h < 6) h += 12
    if (!part && h >= 1 && h <= 7) h += 12 // "2시" → 보통 오후 2시
    return [h % 24, Math.min(min, 59)]
  }
  const p = text.match(PART_OF_DAY)
  if (p) return p[1] === '아침' ? [9, 0] : p[1] === '점심' ? [12, 0] : [18, 0]
  return null
}

const REQUEST_VERB = /(사\s?다|사\s?와|사\s?오|사\s?가|사\s?줘|주문|구매|챙겨|갖다|가져다|가져와|부탁|해\s?줘|해\s?달|봐\s?줘|알아봐)/
const PURCHASE_VERB = /(사\s?다|사\s?와|사\s?오|사\s?가|사\s?줘|주문|구매)/

/** 제목으로 쓰기 좋게 날짜·시간·말끝을 걷어내고 "~하기" 꼴로 다듬는다. */
function tidyTitle(text: string): string {
  let t = text
  for (const p of [...DATE_PATTERNS, TIME_PATTERN, PART_OF_DAY]) t = t.replace(new RegExp(p.source, 'g'), ' ')
  t = t.replace(/(에|에는|쯤|까지)(?=\s|$)/g, ' ').replace(/\s좀\s/g, ' ').replace(/\s+/g, ' ').trim()
  const rules: [RegExp, string][] = [
    [/\s*(했어요|했어|했다|했음|함|할게요|할게|해요|해)$/u, ''],
    [/(\S+)하러\s?(오기로|가기로|오기|가기|와|가)?$/u, '$1'],
    [/(가|오|만나|보|먹|사)기로$/u, '$1기'],
    [/(먹|가|만나|보)자$/u, '$1기'],
    [/(\S{2,})도\s(?=사|주문|챙|갖|가져)/u, '$1 '],
    [/\s?사\s?(와|오|다|가|줘)?(기로|기)?$/u, ' 사기'],
    [/\s?주문\s?해?\s?(줘|주세요|달래)?$/u, ' 주문'],
    [/\s?(해\s?줘|해\s?주세요|해\s?달래|부탁해)$/u, ''],
    [/\s?알아봐\s?(줘|주세요)?$/u, ' 알아보기'],
    [/\s?챙겨\s?(줘|주세요)?$/u, ' 챙기기'],
    [/\s?(을|를|은|는)$/u, ''],
  ]
  for (const [re, rep] of rules) t = t.replace(re, rep)
  return t.replace(/\s+/g, ' ').trim()
}

/** 통화 메모에서 일정·부탁 제안을 만든다. */
export function extractFromCallNote(note: string, now: Date = new Date()): CallSuggestion[] {
  const clauses = note
    .split(/[.!?\n]|(?:,\s*)|(?:\s그리고\s)|(?:\s또\s)/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2)

  const out: CallSuggestion[] = []
  for (const clause of clauses) {
    const date = findDate(clause, now)
    if (date) {
      const [h, m] = findTime(clause) ?? [12, 0]
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m)
      out.push({ kind: 'schedule', title: tidyTitle(clause) || '가족 약속', startAt: toLocalDateTime(start), source: clause })
      continue
    }
    if (REQUEST_VERB.test(clause)) {
      out.push({ kind: 'request', title: tidyTitle(clause) || clause, purchase: PURCHASE_VERB.test(clause), source: clause })
    }
  }
  return out
}

/** 테스트·화면용: 날짜만 'YYYY-MM-DD'로 */
export const dateKeyOf = (d: Date | null) => (d ? toDateKey(d) : null)
