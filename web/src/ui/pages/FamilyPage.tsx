import { useState } from 'react'
import { ROLE_LABEL, type Member, type Role } from '../../domain/models'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { CallButton } from '../components/call'
import { Avatar, Badge, Modal, TopBar } from '../components/common'
import { Icon } from '../components/icons'

/** 우리 가족 (자녀 화면): 구성원·전화번호, 부모님께 사용법 알려 드리기, 초대, 하지 않는 것 */
export function FamilyPage() {
  const { state, toast, resetDemo, signOut } = useStore()
  const [adding, setAdding] = useState(false)
  const [editingPhone, setEditingPhone] = useState<Member | null>(null)

  async function invite() {
    const text = `'우리집 오늘'에서 ${state.familyName} 소식을 같이 봐요! 초대 코드: ${state.inviteCode}`
    // TODO(서버 연동): 실제 초대 링크를 발급해 공유한다.
    try {
      if (navigator.share) await navigator.share({ title: '우리집 오늘 초대', text })
      else {
        await navigator.clipboard.writeText(text)
        toast('초대 메시지를 복사했어요')
      }
    } catch {
      /* 공유 취소 */
    }
  }

  return (
    <>
      <TopBar title="우리 가족" />
      <main className="page detail">
        <h3 className="section">구성원</h3>
        <ul className="members">
          {state.members.map((m) => (
            <li key={m.id} className="member-row">
              <Avatar member={m} />
              <span className="grow">
                <div className="name">
                  {m.name} {m.id === state.currentUserId && <span className="muted small">(나)</span>}
                </div>
                <div className="muted small">
                  <Badge tone={m.role === 'parent' ? 'orange' : 'green'}>{ROLE_LABEL[m.role]}</Badge>{' '}
                  <button className="link-btn" onClick={() => setEditingPhone(m)}>
                    {m.phone ?? '전화번호 등록'}
                  </button>
                </div>
              </span>
              {m.id !== state.currentUserId && <CallButton memberId={m.id} className="btn btn-tonal call-small" />}
            </li>
          ))}
        </ul>
        <button className="btn btn-outline" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> 가족 추가
        </button>

        <h3 className="section">부모님께 알려 드리기</h3>
        <div className="card soft guide">
          <p className="muted">부모님 화면은 글씨가 크고 버튼이 몇 개 없어요. 옆에서 한 번만 같이 눌러 보세요.</p>
          <ol>
            <li>
              처음 화면에서 <b>"부모님이에요"</b> → 이름을 누르면 시작해요.
            </li>
            <li>
              가족이 일정을 물어보면 <b>"좋아요 / 다른 시간이 좋아요 / 이번엔 어려워요"</b> 중 하나만 누르면 돼요.
            </li>
            <li>
              사진은 맨 아래 <b>"사진 보내기"</b>, 필요한 게 있으면 <b>"부탁하기"</b>를 눌러요.
            </li>
            <li>
              <b>"📞 이름"</b>을 누르면 바로 전화가 걸려요. 통화 후 <b>🎤 말로 알려 주기</b>로 정한 걸 남기면 일정·부탁으로 정리돼요.
            </li>
          </ol>
        </div>

        <div className="card invite">
          <b>가족 초대하기</b>
          <div>
            초대 코드 <code>{state.inviteCode}</code>
          </div>
          <button className="btn btn-primary" onClick={invite}>
            <Icon name="share" size={18} /> 초대 메시지 보내기
          </button>
        </div>

        <h3 className="section">우리집 오늘이 하지 않는 것</h3>
        <ul className="card soft promises">
          <li>상시 위치 추적을 하지 않아요.</li>
          <li>접속하지 않거나 응답이 없다고 '안부 경고'를 보내지 않아요.</li>
          <li>통화 내용을 녹음하지 않아요. 정한 것만 직접 남겨요.</li>
          <li>자녀를 담당자로 자동 지정하지 않아요. 맡는 건 각자 선택이에요.</li>
          <li>가족 소식 사이에 쇼핑 광고를 끼워 넣지 않아요.</li>
        </ul>

        <h3 className="section">이 기기</h3>
        <p className="hint">지금은 서버 없이 이 브라우저에만 저장돼요. 다른 기기와는 공유되지 않아요.</p>
        <div className="row gap8">
          <button className="btn btn-outline grow" onClick={signOut}>
            사용자 바꾸기
          </button>
          <button className="btn btn-text danger" onClick={() => confirm('모든 데이터를 지우고 샘플로 되돌릴까요?') && resetDemo()}>
            샘플로 초기화
          </button>
        </div>
      </main>
      {adding && <AddMemberDialog onClose={() => setAdding(false)} />}
      {editingPhone && <PhoneDialog member={editingPhone} onClose={() => setEditingPhone(null)} />}
    </>
  )
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const { run } = useStore()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [role, setRole] = useState<Role>('parent')
  const [phone, setPhone] = useState('')
  const save = () => {
    const o = run((s, c) => R.addMember(s, c, name, relation, role), `${name.trim()}님을 추가했어요`)
    if (o.ok && o.id && phone.trim()) run((s) => R.setMemberPhone(s, o.id!, phone))
    if (o.ok) onClose()
  }
  return (
    <Modal
      title="가족 추가"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={save}>
            추가
          </button>
        </>
      }
    >
      <div className="segmented">
        {(['parent', 'child'] as Role[]).map((r) => (
          <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <label className="field">
        <span>부르는 이름</span>
        <input className="input" placeholder="예: 할머니" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>관계 (선택)</span>
        <input className="input" placeholder="예: 외할머니" value={relation} onChange={(e) => setRelation(e.target.value)} />
      </label>
      <label className="field">
        <span>전화번호 (선택)</span>
        <input className="input" type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
    </Modal>
  )
}

function PhoneDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const { run } = useStore()
  const [phone, setPhone] = useState(member.phone ?? '')
  return (
    <Modal
      title={`${member.name} 전화번호`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={() => run((s) => R.setMemberPhone(s, member.id, phone), '전화번호를 저장했어요').ok && onClose()}>
            저장
          </button>
        </>
      }
    >
      <input className="input" type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
    </Modal>
  )
}
