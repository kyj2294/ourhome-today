import { useState } from 'react'
import * as R from '../../domain/rules'
import { useStore } from '../../store/store'
import { Avatar, Modal, TopBar } from '../components/common'
import { Icon } from '../components/icons'

/** 우리 가족: 구성원(사용자 전환), 초대, 이 앱이 일부러 하지 않는 것 */
export function FamilyPage() {
  const { state, run, toast, resetDemo } = useStore()
  const [adding, setAdding] = useState(false)

  async function invite() {
    const text = `'우리집 오늘'에서 ${state.familyName} 소식을 같이 봐요! 초대 코드: ${state.inviteCode}`
    // TODO(서버 연동): 실제 초대 링크를 발급해 공유한다.
    try {
      if (navigator.share) await navigator.share({ title: '우리집 오늘 초대', text, url: window.location.origin })
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.origin}`)
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
        <div className="card invite">
          <b>가족 초대하기</b>
          <div>
            초대 코드 <code>{state.inviteCode}</code>
          </div>
          <p className="small">앱을 자주 열지 않는 가족도 링크로 해당 항목을 열어 보고 응답할 수 있게 만들 예정이에요.</p>
          <button className="btn btn-primary" onClick={invite}>
            <Icon name="share" size={18} /> 초대 메시지 보내기
          </button>
        </div>

        <h3 className="section">구성원</h3>
        <p className="hint">
          프로토타입: 아래에서 가족을 고르면 그 사람 입장에서 써 볼 수 있어요. 브라우저 탭을 두 개 열고 각각 다른 가족으로 바꾸면 실시간으로 함께 바뀌어요.
        </p>
        <ul className="members">
          {state.members.map((m) => (
            <li key={m.id}>
              <label className="row gap10">
                <Avatar member={m} />
                <span className="grow">
                  <div className="name">{m.name}</div>
                  <div className="muted small">{m.relation}</div>
                </span>
                <input
                  type="radio"
                  name="me"
                  checked={state.currentUserId === m.id}
                  onChange={() => run((s) => R.switchUser(s, m.id), `${m.name} 입장으로 전환했어요`)}
                />
              </label>
            </li>
          ))}
        </ul>
        <button className="btn btn-outline" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> 가족 추가
        </button>

        <h3 className="section">우리집 오늘이 하지 않는 것</h3>
        <ul className="card soft promises">
          <li>상시 위치 추적을 하지 않아요.</li>
          <li>접속하지 않거나 응답이 없다고 '안부 경고'를 보내지 않아요.</li>
          <li>사진을 분석해 필요한 물건이나 부모님의 뜻을 추정하지 않아요.</li>
          <li>자녀를 담당자로 자동 지정하지 않아요. 맡는 건 각자 선택이에요.</li>
          <li>가족 소식 사이에 쇼핑 광고를 끼워 넣지 않아요.</li>
        </ul>

        <h3 className="section">데이터</h3>
        <p className="hint">지금은 서버 없이 이 브라우저에만 저장돼요. 다른 기기와는 공유되지 않아요.</p>
        <button className="btn btn-text danger" onClick={() => confirm('모든 데이터를 지우고 샘플로 되돌릴까요?') && resetDemo()}>
          샘플 데이터로 초기화
        </button>
      </main>
      {adding && <AddMemberDialog onClose={() => setAdding(false)} />}
    </>
  )
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const { run } = useStore()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  return (
    <Modal
      title="가족 추가"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-text" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={() => run((s, c) => R.addMember(s, c, name, relation), `${name.trim()}님을 추가했어요`).ok && onClose()}>
            추가
          </button>
        </>
      }
    >
      <label className="field">
        <span>부르는 이름</span>
        <input className="input" placeholder="예: 할머니" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>관계 (선택)</span>
        <input className="input" placeholder="예: 외할머니" value={relation} onChange={(e) => setRelation(e.target.value)} />
      </label>
    </Modal>
  )
}
