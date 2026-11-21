import { addDays, toDateKey, toLocalDateTime } from './dates'
import type { FamilyState } from './models'

export const MOM = 'm_mom'
export const DAD = 'm_dad'
export const MINSU = 'm_minsu'
export const JIEUN = 'm_jieun'

export const SCHEMA_VERSION = 4

/**
 * 시연용 샘플 데이터. 기획서의 '정수기 필터 부탁' 이용 흐름을 재현한다.
 * 사진 값이 "sample:"로 시작하면 화면에서 자리표시 이미지로 그린다.
 */
export function sampleState(now: Date = new Date()): FamilyState {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString()
  const today = toDateKey(now)
  const nextSat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (((6 - now.getDay() + 7) % 7) || 7), 10, 0)
  const everyoneBut = (id: string) => [MOM, DAD, MINSU, JIEUN].filter((m) => m !== id)

  return {
    schema: SCHEMA_VERSION,
    familyName: '우리집',
    inviteCode: 'OURHOME-2026',
    currentUserId: MINSU,
    members: [
      { id: MOM, role: 'parent', name: '엄마', relation: '어머니', color: '#e57373', phone: '010-0000-0001' },
      { id: DAD, role: 'parent', name: '아빠', relation: '아버지', color: '#64b5f6', phone: '010-0000-0002' },
      { id: MINSU, role: 'child', name: '민수', relation: '아들', color: '#81c784', phone: '010-0000-0003' },
      { id: JIEUN, role: 'child', name: '지은', relation: '딸', color: '#ba68c8', phone: '010-0000-0004' },
    ],
    posts: [
      // 1) 그냥 일상 소식 — 부탁이나 알림을 만들지 않는다.
      {
        id: 'p1',
        authorId: MOM,
        text: '베란다 화분에 꽃이 피었어요 🌸 올해는 유난히 일찍 피네.',
        photos: ['sample:꽃 핀 베란다 화분'],
        createdAt: ago(2),
        readBy: [MOM, JIEUN, DAD],
        comments: [{ id: 'c1', authorId: JIEUN, text: '와 예쁘다! 다음에 가면 직접 볼래요', createdAt: ago(1) }],
      },
      // 2) 일상 공유 → 글쓴이가 직접 '가족에게 부탁'으로 연결 (아직 맡은 사람 없음)
      {
        id: 'p2',
        authorId: MOM,
        text: '요즘 물맛이 좀 달라졌네. 정수기 필터 바꿀 때가 됐나 봐.',
        photos: ['sample:정수기 필터 사진'],
        createdAt: ago(5),
        readBy: [MOM, DAD],
        comments: [],
        linkedRequestId: 'r1',
      },
      // 3) 자녀가 방문 일정을 제안
      {
        id: 'p3',
        authorId: MINSU,
        text: '이번 주말에 김장 도우러 갈게요! 다들 시간 괜찮으세요?',
        photos: [],
        createdAt: ago(24),
        readBy: [MINSU, MOM, DAD, JIEUN],
        comments: [],
        linkedScheduleId: 's1',
      },
      // 4) 연결 없는 일상 소식
      {
        id: 'p4',
        authorId: DAD,
        text: '오늘 아침 동네 뒷산. 공기가 차가워졌다.',
        photos: ['sample:아침 산책길', 'sample:산 정상 풍경'],
        createdAt: ago(27),
        readBy: [DAD, MOM],
        comments: [],
      },
    ],
    requests: [
      {
        id: 'r1',
        sourcePostId: 'p2',
        requesterId: MOM,
        title: '정수기 필터 주문',
        detail: '사진에 있는 필터랑 같은 걸로 부탁해요.',
        dueDate: addDays(today, 7),
        audienceIds: everyoneBut(MOM),
        purchase: { spec: '주방 정수기 호환 필터 세트 (사진 속 모델)', quantity: 1 },
        status: 'OPEN',
        seenBy: [MOM, DAD],
        history: [{ actorId: MOM, message: '부탁을 등록했어요', at: ago(5) }],
        createdAt: ago(5),
      },
      // 부모님이 자녀의 부탁을 맡은 예 — 역할을 고정하지 않는다.
      {
        id: 'r2',
        requesterId: JIEUN,
        title: '엄마 건강검진 병원 예약 전화',
        detail: '다음 달 중에 평일 오전으로요.',
        dueDate: today,
        audienceIds: [DAD, MINSU],
        assigneeId: DAD,
        status: 'IN_PROGRESS',
        seenBy: [JIEUN, DAD, MINSU],
        history: [
          { actorId: JIEUN, message: '부탁을 등록했어요', at: ago(48) },
          { actorId: DAD, message: '제가 챙길게요', at: ago(45) },
          { actorId: DAD, message: '진행 중이에요', at: ago(24) },
        ],
        createdAt: ago(48),
      },
    ],
    schedules: [
      {
        id: 's1',
        sourcePostId: 'p3',
        proposerId: MINSU,
        title: '주말 김장하기',
        startAt: toLocalDateTime(nextSat),
        place: '부모님 댁',
        audienceIds: everyoneBut(MINSU),
        responses: {
          [MOM]: { memberId: MOM, availability: 'AVAILABLE', version: 1, at: ago(20) },
          [DAD]: { memberId: DAD, availability: 'RESCHEDULE', note: '오후 2시 이후가 좋겠다', version: 1, at: ago(18) },
        },
        version: 1,
        confirmed: false,
        canceled: false,
        history: [{ actorId: MINSU, message: '일정을 제안했어요', at: ago(24) }],
        createdAt: ago(24),
      },
    ],
    notifications: [],
    // 안부 질문: 지은이 부모님께 — 아빠는 답했고 엄마는 아직
    questions: [
      {
        id: 'q1',
        askerId: JIEUN,
        targetIds: [MOM, DAD],
        card: 'pill',
        message: '엄마 아빠, 오늘도 약 꼭 챙겨 드세요!',
        text: '오늘 혈압약 드셨어요?',
        options: ['먹었어요', '아직이요', '이따 먹을게요'],
        answers: { [DAD]: { option: '먹었어요', at: ago(0.5) } },
        createdAt: ago(1),
      },
    ],
    // 자동 안부: 지은이 매일 아침 8시·저녁 8시에 약 확인
    routines: [
      {
        id: 'rt1',
        ownerId: JIEUN,
        targetIds: [MOM, DAD],
        text: '약 드셨어요?',
        options: ['먹었어요', '아직이요', '이따 먹을게요'],
        card: 'pill',
        message: '오늘도 약 꼭 챙겨 드세요!',
        days: [0, 1, 2, 3, 4, 5, 6],
        times: ['08:00', '20:00'],
        enabled: true,
        lastFiredAt: now.toISOString(),
        createdAt: ago(72),
      },
    ],
  }
}
