import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as R from '../../domain/rules'
import { compressImage } from '../../store/images'
import { useStore } from '../../store/store'
import { Photo, TopBar } from '../components/common'
import { Icon } from '../components/icons'

const MAX_PHOTOS = 5

type Next = 'share' | 'schedule' | 'request'
const OPTIONS: { key: Next; label: string; desc: string }[] = [
  { key: 'share', label: '그냥 소식', desc: '가족 소식으로만 올려요' },
  { key: 'schedule', label: '일정 제안', desc: '이 글로 가족 일정을 제안해요' },
  { key: 'request', label: '가족에게 부탁', desc: '이 글의 사진·설명으로 부탁을 만들어요' },
]

/**
 * 소식 올리기. 기본은 일상 게시이며, 제목·기한·담당을 요구하지 않는다.
 * 글쓴이가 원할 때만 '일정 제안'이나 '가족에게 부탁'으로 이어간다.
 */
export function ComposePage() {
  const { run, toast } = useStore()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [next, setNext] = useState<Next>('share')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null) {
    if (!files) return
    setBusy(true)
    try {
      const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length)
      const urls = await Promise.all(picked.map((f) => compressImage(f)))
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS))
    } catch {
      toast('사진을 불러오지 못했어요')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function submit() {
    const o = run((s, ctx) => R.createPost(s, ctx, text, photos), next === 'share' ? '가족 소식을 올렸어요' : undefined)
    if (!o.ok) return
    if (next === 'share') navigate('/', { replace: true })
    else navigate(`/${next}/new?postId=${o.id}`, { replace: true })
  }

  return (
    <>
      <TopBar title="소식 올리기" back />
      <main className="page form">
        <textarea
          className="input textarea"
          placeholder="오늘 있었던 일을 가족과 나눠 보세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
        />
        <div className="photo-picker">
          {photos.map((p, i) => (
            <div key={i} className="thumb">
              <Photo src={p} className="photo-thumb" />
              <button className="thumb-remove" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="사진 빼기">
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button className="thumb thumb-add" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Icon name="camera" />
              <span>{busy ? '불러오는 중' : `사진 ${photos.length}/${MAX_PHOTOS}`}</span>
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>

        <h3 className="section">이 글로 무엇을 할까요?</h3>
        {OPTIONS.map((o) => (
          <label key={o.key} className={`radio-row ${next === o.key ? 'radio-on' : ''}`}>
            <input type="radio" name="next" checked={next === o.key} onChange={() => setNext(o.key)} />
            <span>
              <b>{o.label}</b>
              <span className="muted">{o.desc}</span>
            </span>
          </label>
        ))}
        <p className="hint">소식은 소식으로 끝나도 괜찮아요. 일정이나 부탁은 나중에 글 상세에서도 연결할 수 있어요.</p>
      </main>
      <div className="bottom-action">
        <button className="btn btn-primary" disabled={busy || (!text.trim() && photos.length === 0)} onClick={submit}>
          {next === 'share' ? '올리기' : next === 'schedule' ? '올리고 일정 제안하기' : '올리고 부탁 만들기'}
        </button>
      </div>
    </>
  )
}
