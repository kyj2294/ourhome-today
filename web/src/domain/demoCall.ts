/**
 * AI 통화 요약 — 예시(데모)
 *
 * 실제 서비스라면 통화 녹음(동의) → 음성 인식 → AI 요약이 필요하다. 웹 프로토타입은 통화 음성을 들을 수 없으므로,
 * 누가 누구에게 걸었는지에 맞춘 "예시 대본"으로 그 모습을 보여준다.
 * 할 일 카드는 진짜 정리 기능(extractFromCallNote)이 요약 문장(note)을 읽어서 만든다.
 */
import { josa } from './korean'
import type { Member } from './models'

export interface DemoCall {
  durationSec: number
  transcript: { who: 'me' | 'other'; text: string }[]
  summary: string[]
  /** 할 일 추출에 쓰는 요약 문장 */
  note: string
}

/** 부르는 말: 자녀가 부모님을 부를 때는 이름(엄마/아빠) 그대로, 그 외엔 이름 */
const call = (m: Member) => m.name

export function demoCallScript(me: Member, other: Member): DemoCall {
  // 부모님 → 자녀: 방문 시간 + 사다 줄 것
  if (me.role === 'parent' && other.role === 'child') {
    return {
      durationSec: 192,
      transcript: [
        { who: 'other', text: `${call(me)}, 이번 주 토요일 김장 몇 시에 가면 돼요?` },
        { who: 'me', text: '오후 2시쯤 와. 오는 길에 고무장갑 하나만 사 오고.' },
        { who: 'other', text: '네, 2시에 갈게요. 고무장갑도 사 갈게요.' },
        { who: 'me', text: '그래, 조심히 와라.' },
      ],
      summary: [`토요일 오후 2시에 ${josa(other.name, '이', '가')} 김장하러 오기로 함`, '오는 길에 고무장갑을 사 오기로 함'],
      note: '토요일 오후 2시에 김장하러 오기로 했어. 고무장갑도 사 오기로 했어',
    }
  }
  // 자녀 → 부모님: 병원 동행 + 챙겨 둘 것
  if (me.role === 'child' && other.role === 'parent') {
    return {
      durationSec: 254,
      transcript: [
        { who: 'me', text: `${call(other)}, 검진 결과 들으러 병원 언제 가요?` },
        { who: 'other', text: '다음 주 월요일 오전 10시래.' },
        { who: 'me', text: '그럼 제가 모시고 갈게요. 신분증이랑 지난번 약봉투 챙겨 주세요.' },
        { who: 'other', text: '그래, 고맙다.' },
      ],
      summary: [`다음 주 월요일 오전 10시 병원에 ${josa(me.name, '이', '가')} 같이 가기로 함`, `${josa(other.name, '이', '가')} 신분증과 약봉투를 챙겨 두기로 함`],
      note: '다음 주 월요일 오전 10시에 병원 같이 가기로 했어. 신분증이랑 약봉투 챙겨 줘',
    }
  }
  // 자녀 ↔ 자녀: 부모님 생신 준비
  if (me.role === 'child' && other.role === 'child') {
    return {
      durationSec: 318,
      transcript: [
        { who: 'me', text: '엄마 생신 저녁 어디서 할까?' },
        { who: 'other', text: '12월 3일 저녁 6시에 집 근처 한정식 집 어때?' },
        { who: 'me', text: '좋아. 그럼 케이크는 네가 주문해 줘.' },
        { who: 'other', text: '알겠어, 내가 할게.' },
      ],
      summary: ['12월 3일 저녁 6시 한정식 집에서 생신 저녁', `케이크는 ${josa(other.name, '이', '가')} 주문하기로 함`],
      note: '12월 3일 저녁 6시 생신 저녁 식사. 케이크 주문해 줘',
    }
  }
  // 부모님 ↔ 부모님
  return {
    durationSec: 96,
    transcript: [
      { who: 'me', text: '내일 오전에 장 보러 같이 갈래요?' },
      { who: 'other', text: '그래, 10시에 나가자.' },
    ],
    summary: ['내일 오전 10시에 같이 장 보러 가기로 함'],
    note: '내일 오전 10시에 장 보러 가기로 했어',
  }
}

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}분 ${sec % 60}초`
