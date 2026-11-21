import { CARD_DESIGNS, type CardDesign, cardOf } from '../../domain/models'

/** 카카오톡 선물하기 카드처럼 메시지를 담는 카드 */
export function MessageCard({ design, message, from, size = 'md' }: { design: CardDesign; message?: string; from?: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = cardOf(design)
  if (!c) return null
  return (
    <div className={`mcard mcard-${design} mcard-${size}`}>
      <span className="mcard-emoji" aria-hidden>
        {c.emoji}
      </span>
      <div className="mcard-title">{c.title}</div>
      {message && size !== 'sm' && <div className="mcard-msg">{message}</div>}
      {from && size !== 'sm' && <div className="mcard-from">From. {from}</div>}
    </div>
  )
}

/** 카드 고르기 (가로로 넘겨 보기) */
export function CardPicker({ value, onChange, allowNone = true }: { value?: CardDesign; onChange: (v?: CardDesign) => void; allowNone?: boolean }) {
  return (
    <div className="card-picker">
      {allowNone && (
        <button type="button" className={`card-pick card-none ${!value ? 'on' : ''}`} onClick={() => onChange(undefined)}>
          카드 없이
        </button>
      )}
      {CARD_DESIGNS.map((c) => (
        <button type="button" key={c.id} className={`card-pick ${value === c.id ? 'on' : ''}`} onClick={() => onChange(c.id)} aria-label={c.title}>
          <MessageCard design={c.id} size="sm" />
        </button>
      ))}
    </div>
  )
}
