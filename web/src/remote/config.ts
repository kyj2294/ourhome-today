/**
 * Supabase 연결 설정
 * - 주소와 공개(publishable) 키는 브라우저에 공개되어도 되는 값이다. 데이터 접근은 DB의 RLS 규칙이 막는다.
 * - 프로토타입이라 가입 없이 정해진 계정 4개로만 로그인한다.
 */
import type { Role } from '../domain/models'

export const SUPABASE_URL = 'https://mbwesjfgtxcqyfrtpyzt.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_xk8OQYZlnLHIC1ZMDxRPYg_yPiTPcNB'

/** 가족 문서 id (oh_families.id) */
export const FAMILY_ID = 'ourhome'

/** 사진 저장소 (비공개, 가족 폴더만 접근) */
export const PHOTO_BUCKET = 'ourhome-photos'

export interface Account {
  memberId: string
  email: string
  name: string
  role: Role
  color: string
}

/** 로그인 화면에 보이는 계정 4개 (비밀번호는 예시로 모두 1234) */
export const ACCOUNTS: Account[] = [
  { memberId: 'm_mom', email: 'mom@ourhome.app', name: '엄마', role: 'parent', color: '#e57373' },
  { memberId: 'm_dad', email: 'dad@ourhome.app', name: '아빠', role: 'parent', color: '#64b5f6' },
  { memberId: 'm_minsu', email: 'minsu@ourhome.app', name: '민수', role: 'child', color: '#81c784' },
  { memberId: 'm_jieun', email: 'jieun@ourhome.app', name: '지은', role: 'child', color: '#ba68c8' },
]

export const DEMO_PIN = '1234'
