/**
 * 고른 사진을 브라우저에서 줄여 data URL로 만든다.
 * 서버가 없는 프로토타입이라 IndexedDB에 그대로 저장하므로, 용량을 줄이는 게 중요하다.
 * TODO(서버 연동): 스토리지(Supabase Storage, R2 등)에 올리고 URL만 저장한다.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.78): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('이미지를 읽을 수 없어요'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}
