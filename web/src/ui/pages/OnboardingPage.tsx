import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Role } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { Avatar } from '../components/common'

/**
 * 처음 화면: 부모님인지 자녀인지 고르고, 이름을 고른다.
 * 부모님은 큰 글씨·꼭 필요한 버튼만 있는 쉬운 화면으로, 자녀는 전체 기능 화면으로 들어간다.
 */
export function OnboardingPage() {
  const { state, run, signIn: storeSignIn } = useStore()
  const navigate = useNavigate()
  // 고르고 나면 항상 첫 화면에서 시작한다
  const signIn = (id: string) => {
    storeSignIn(id)
    navigate('/', { replace: true })
  }
  const [role, setRole] = useState<Role | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  if (!role) {
    return (
      <main className="onboarding">
        <div className="onb-hero">
          <div className="onb-logo">🏠</div>
          <h1>우리집 오늘</h1>
          <p>따로 살아도, 오늘을 함께</p>
        </div>
        <h2 className="onb-question">누가 쓰시나요?</h2>
        <button className="role-card role-parent" onClick={() => setRole('parent')}>
          <span className="role-emoji">👵👴</span>
          <span className="role-text">
            <b>부모님이에요</b>
            <span>글씨가 크고 쉬운 화면</span>
          </span>
        </button>
        <button className="role-card role-child" onClick={() => setRole('child')}>
          <span className="role-emoji">🧑</span>
          <span className="role-text">
            <b>자녀예요</b>
            <span>일정·부탁을 정리하고 챙기는 화면</span>
          </span>
        </button>
      </main>
    )
  }

  const people = state.members.filter((m) => m.role === role)
  const add = () => {
    const o = run((s, c) => R.addMember(s, c, name, role === 'parent' ? '부모님' : '자녀', role))
    if (o.ok && o.id) signIn(o.id)
  }

  return (
    <main className={`onboarding ${role === 'parent' ? 'onb-big' : ''}`}>
      <button className="onb-back" onClick={() => setRole(null)}>
        ← 처음으로
      </button>
      <h2 className="onb-question">{role === 'parent' ? '누구세요?' : '누구인가요?'}</h2>
      <div className="onb-people">
        {people.map((m) => (
          <button key={m.id} className="person-card" onClick={() => signIn(m.id)}>
            <Avatar member={m} size={role === 'parent' ? 64 : 48} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      {adding ? (
        <div className="onb-add">
          <input
            className="input"
            placeholder={role === 'parent' ? '예: 엄마, 아빠, 할머니' : '예: 민수'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" disabled={!name.trim()} onClick={add}>
            시작하기
          </button>
        </div>
      ) : (
        <button className="btn btn-outline onb-add-btn" onClick={() => setAdding(true)}>
          + 목록에 없어요
        </button>
      )}
    </main>
  )
}
