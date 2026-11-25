import { useRef, useState, type ReactNode } from 'react'
import { CARD_DESIGNS, type CardDesign, type CardTextStyle, cardOf } from '../../domain/models'
import { compressImage } from '../../store/images'
import { useStore } from '../../store/store'

/*
 * 카카오톡 선물하기 카드처럼: 정사각형 카드 위에 큰 글씨로 마음을 적는다.
 * 디자인 여러 개 중 고르거나, 내 사진을 배경으로 쓸 수 있다.
 * (캐릭터 대신 그라데이션 배경 + 큰 그림 + 손글씨 장식으로 직접 만든 디자인)
 */

export const CARD_MAX = 100

export interface CardValue {
  design: CardDesign
  message: string
  photo?: string
  text?: CardTextStyle
}

const TEXT_STYLES: CardTextStyle[] = ['light', 'dark', 'box']
const TEXT_STYLE_LABEL: Record<CardTextStyle, string> = { light: '흰 글씨', dark: '진한 글씨', box: '바탕 글씨' }

/** 카드 바탕 (배경·그림·장식). 글씨는 children으로 받는다. */
function CardFace({ design, photo, textStyle, size, children }: { design: CardDesign; photo?: string; textStyle: CardTextStyle; size: 'sm' | 'md' | 'lg'; children?: ReactNode }) {
  const c = cardOf(design)!
  return (
    <div className={`kcard kcard-${design} kcard-${size} kcard-text-${textStyle}`} style={design === 'photo' && photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {design !== 'photo' && (
        <div className="kcard-art" aria-hidden>
          <span className="kcard-emoji">{c.emoji}</span>
          {c.script && <span className="kcard-script">{c.script}</span>}
        </div>
      )}
      {design === 'photo' && !photo && <div className="kcard-photo-empty">📷 사진을 골라 주세요</div>}
      {children}
    </div>
  )
}

/** 보여주기용 카드 */
export function MessageCard({
  design,
  message,
  photo,
  textStyle,
  from,
  size = 'md',
}: {
  design: CardDesign
  message?: string
  photo?: string
  textStyle?: CardTextStyle
  from?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const c = cardOf(design)
  if (!c) return null
  return (
    <CardFace design={design} photo={photo} textStyle={textStyle ?? c.text} size={size}>
      {size !== 'sm' && message && <div className="kcard-message">{message}</div>}
      {size !== 'sm' && from && <div className="kcard-from">From. {from}</div>}
    </CardFace>
  )
}

/**
 * 카드 만들기 화면 (카카오톡 카드 편집처럼)
 * 취소 · Aa(글씨 스타일) · 확인 / 카드 위에 바로 글쓰기 / ‹ › 와 아래 줄로 디자인 고르기 / 📷 내 사진
 */
export function CardEditor({ initial, onCancel, onConfirm }: { initial?: CardValue; onCancel: () => void; onConfirm: (v: CardValue) => void }) {
  const { toast, uploadImage } = useStore()
  const first = initial ?? { design: CARD_DESIGNS[0].id, message: CARD_DESIGNS[0].message }
  const [design, setDesign] = useState<CardDesign>(first.design)
  const [message, setMessage] = useState(first.message)
  const [photo, setPhoto] = useState(first.photo)
  const [textStyle, setTextStyle] = useState<CardTextStyle>(first.text ?? cardOf(first.design)!.text)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const order: CardDesign[] = ['photo', ...CARD_DESIGNS.map((c) => c.id)]

  /** 디자인을 바꾸면 기본 문구·글씨 스타일도 바꾼다 (직접 고친 글은 그대로 둔다) */
  const choose = (next: CardDesign) => {
    if (next === 'photo' && !photo) {
      fileInput.current?.click()
      return
    }
    const prev = cardOf(design)!
    const n = cardOf(next)!
    if (!message.trim() || message === prev.message) setMessage(n.message)
    if (textStyle === prev.text) setTextStyle(next === 'photo' ? 'box' : n.text)
    setDesign(next)
  }
  const step = (delta: number) => {
    const i = order.indexOf(design)
    let j = (i + delta + order.length) % order.length
    if (order[j] === 'photo' && !photo) j = (j + delta + order.length) % order.length
    choose(order[j])
  }

  async function pickPhoto(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const url = await uploadImage(await compressImage(f, 1080, 0.8))
      setPhoto(url)
      if (message === cardOf(design)!.message) setMessage('')
      setTextStyle('box')
      setDesign('photo')
    } catch {
      toast('사진을 불러오지 못했어요')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="card-editor" role="dialog" aria-label="카드 만들기">
      <header className="ce-bar">
        <button onClick={onCancel}>취소</button>
        <button
          className="ce-aa"
          onClick={() => setTextStyle(TEXT_STYLES[(TEXT_STYLES.indexOf(textStyle) + 1) % TEXT_STYLES.length])}
          aria-label={`글씨 스타일: ${TEXT_STYLE_LABEL[textStyle]}`}
        >
          Aa
        </button>
        <button onClick={() => onConfirm({ design, message: message.trim(), photo: design === 'photo' ? photo : undefined, text: textStyle })} disabled={busy || (design === 'photo' && !photo)}>
          확인
        </button>
      </header>

      <div className="ce-stage">
        <button className="ce-arrow" onClick={() => step(-1)} aria-label="이전 디자인">
          ‹
        </button>
        <CardFace design={design} photo={photo} textStyle={textStyle} size="lg">
          <textarea
            className="kcard-message kcard-input"
            value={message}
            maxLength={CARD_MAX}
            rows={3}
            placeholder="여기를 눌러 마음을 적어 보세요"
            onChange={(e) => setMessage(e.target.value)}
            aria-label="카드에 쓸 말"
          />
          <span className="kcard-count">
            {message.length}/{CARD_MAX}
          </span>
        </CardFace>
        <button className="ce-arrow" onClick={() => step(1)} aria-label="다음 디자인">
          ›
        </button>
      </div>
      <div className="ce-style-label">{TEXT_STYLE_LABEL[textStyle]} · Aa를 누르면 바뀌어요</div>

      <div className="ce-strip">
        <button className={`ce-thumb ce-photo-btn ${design === 'photo' ? 'on' : ''}`} onClick={() => (photo ? choose('photo') : fileInput.current?.click())} disabled={busy}>
          {photo ? <span className="ce-photo-thumb" style={{ backgroundImage: `url(${photo})` }} /> : <span className="ce-photo-icon">📷</span>}
          <span>{busy ? '불러오는 중' : photo ? '내 사진' : '내 사진 올리기'}</span>
        </button>
        {photo && (
          <button className="ce-thumb ce-change-photo" onClick={() => fileInput.current?.click()}>
            <span className="ce-photo-icon">🔄</span>
            <span>사진 바꾸기</span>
          </button>
        )}
        {CARD_DESIGNS.map((c) => (
          <button key={c.id} className={`ce-thumb ${design === c.id ? 'on' : ''}`} onClick={() => choose(c.id)} aria-label={c.title}>
            <MessageCard design={c.id} size="sm" />
            <span>{c.title}</span>
          </button>
        ))}
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files)} />
    </div>
  )
}

/** 입력 화면에 넣는 카드 칸: 미리보기 + 꾸미기/빼기 */
export function CardSlot({ value, onChange, required = false, from }: { value?: CardValue; onChange: (v?: CardValue) => void; required?: boolean; from?: string }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="card-slot">
      {value ? (
        <>
          <button className="card-slot-preview" onClick={() => setEditing(true)} aria-label="카드 꾸미기">
            <MessageCard design={value.design} message={value.message} photo={value.photo} textStyle={value.text} from={from} />
          </button>
          <div className="row gap8">
            <button type="button" className="btn btn-tonal grow" onClick={() => setEditing(true)}>
              🎨 카드 꾸미기
            </button>
            {!required && (
              <button type="button" className="btn btn-text" onClick={() => onChange(undefined)}>
                카드 빼기
              </button>
            )}
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-outline card-slot-add" onClick={() => setEditing(true)}>
          💌 카드로 꾸며서 보내기
        </button>
      )}
      {editing && (
        <CardEditor
          initial={value}
          onCancel={() => setEditing(false)}
          onConfirm={(v) => {
            onChange(v)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
