/** Supabase 호출 모음: 로그인, 가족 문서 읽기·저장, 실시간 구독, 사진 올리기 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { FamilyState } from '../domain/models'
import { ACCOUNTS, FAMILY_ID, PHOTO_BUCKET, SUPABASE_KEY, SUPABASE_URL } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ourhome-today-auth' },
})

export interface FamilyRow {
  state: FamilyState | Record<string, never>
  version: number
}

/** 계정 4개 중 하나로 로그인 */
export async function login(memberId: string, pin: string): Promise<string | null> {
  const acc = ACCOUNTS.find((a) => a.memberId === memberId)
  if (!acc) return '계정을 찾을 수 없어요'
  const { error } = await supabase.auth.signInWithPassword({ email: acc.email, password: pin })
  if (!error) return null
  return error.message.includes('Invalid login') ? '비밀번호가 달라요' : '로그인하지 못했어요. 인터넷 연결을 확인해 주세요'
}

export async function logout() {
  await supabase.auth.signOut()
}

/** 로그인된 사람의 가족 구성원 id (없으면 null) */
export async function myMemberId(): Promise<string | null> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) return null
  const { data, error } = await supabase.from('oh_members').select('member_id').eq('user_id', s.session.user.id).maybeSingle()
  if (error) throw error
  return data?.member_id ?? null
}

export async function fetchFamily(): Promise<FamilyRow> {
  const { data, error } = await supabase.from('oh_families').select('state, version').eq('id', FAMILY_ID).single()
  if (error) throw error
  return data as FamilyRow
}

/** 버전이 맞을 때만 저장. 새 버전 또는 (다른 기기가 먼저 저장했으면) null */
export async function saveFamily(state: FamilyState, version: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('oh_save_state', { p_family: FAMILY_ID, p_state: state, p_version: version })
  if (error) throw error
  return (data as number | null) ?? null
}

let familyChannel: RealtimeChannel | null = null

/**
 * 다른 기기의 변경을 실시간으로 받는다.
 * - broadcast 'saved': 저장한 기기가 바로 보내는 신호 → 받은 기기는 최신 상태를 다시 읽는다 (주 경로)
 * - postgres_changes: DB 변경 알림 (보조 경로)
 */
export function subscribeFamily(onChange: (row: FamilyRow) => void, onPing: () => void): RealtimeChannel {
  familyChannel = supabase
    .channel(`family-${FAMILY_ID}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'saved' }, () => onPing())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'oh_families', filter: `id=eq.${FAMILY_ID}` }, (payload) => {
      const row = payload.new as { state?: FamilyState; version?: number }
      if (row && typeof row.version === 'number' && row.state) onChange({ state: row.state, version: row.version })
    })
    .subscribe()
  return familyChannel
}

/** 저장했다고 다른 기기에 알린다 */
export function notifySaved(version: number) {
  void familyChannel?.send({ type: 'broadcast', event: 'saved', payload: { version } })
}

/** 사진을 가족 폴더에 올리고, 1년짜리 보기 링크를 돌려준다 */
export async function uploadPhoto(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${FAMILY_ID}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data, error: e2 } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365)
  if (e2 || !data) throw e2 ?? new Error('사진 링크를 만들지 못했어요')
  return data.signedUrl
}
