package com.ourhome.today.data

import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.Comment
import com.ourhome.today.data.model.FamilyRequest
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.HistoryEntry
import com.ourhome.today.data.model.Member
import com.ourhome.today.data.model.Post
import com.ourhome.today.data.model.PurchaseSpec
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.data.model.SchedulePlan
import com.ourhome.today.data.model.ScheduleResponse
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.temporal.TemporalAdjusters

/**
 * 프로토타입 시연용 샘플 데이터. 기획서의 '정수기 필터 부탁' 이용 흐름을 그대로 재현한다.
 * 사진 URI가 "sample:"로 시작하면 화면에서 자리표시 이미지로 그린다.
 */
object SampleData {
    const val MOM = "m_mom"
    const val DAD = "m_dad"
    const val MINSU = "m_minsu"
    const val JIEUN = "m_jieun"

    val members = listOf(
        Member(MOM, "엄마", "어머니", 0xFFE57373),
        Member(DAD, "아빠", "아버지", 0xFF64B5F6),
        Member(MINSU, "민수", "아들", 0xFF81C784),
        Member(JIEUN, "지은", "딸", 0xFFBA68C8),
    )

    fun initialState(now: LocalDateTime = LocalDateTime.now()): FamilyState {
        val everyone = members.map { it.id }.toSet()
        val nextSaturday = now.toLocalDate()
            .with(TemporalAdjusters.next(DayOfWeek.SATURDAY))
            .atTime(10, 0)

        // 1) 그냥 일상 소식 — 부탁이나 알림을 만들지 않는다.
        val flowerPost = Post(
            id = "p1",
            authorId = MOM,
            text = "베란다 화분에 꽃이 피었어요 🌸 올해는 유난히 일찍 피네.",
            photoUris = listOf("sample:꽃 핀 베란다 화분"),
            createdAt = now.minusHours(2),
            readBy = setOf(MOM, JIEUN, DAD),
            comments = listOf(
                Comment("c1", JIEUN, "와 예쁘다! 다음에 가면 직접 볼래요", now.minusHours(1)),
            ),
        )

        // 2) 일상 공유 → 글쓴이가 직접 '가족에게 부탁'으로 연결 (아직 맡은 사람 없음)
        val filterPost = Post(
            id = "p2",
            authorId = MOM,
            text = "요즘 물맛이 좀 달라졌네. 정수기 필터 바꿀 때가 됐나 봐.",
            photoUris = listOf("sample:정수기 필터 사진"),
            createdAt = now.minusHours(5),
            readBy = setOf(MOM, DAD),
            linkedRequestId = "r1",
        )
        val filterRequest = FamilyRequest(
            id = "r1",
            sourcePostId = "p2",
            requesterId = MOM,
            title = "정수기 필터 주문",
            detail = "사진에 있는 필터랑 같은 걸로 부탁해요.",
            dueDate = now.toLocalDate().plusDays(7),
            audienceIds = everyone - MOM,
            purchase = PurchaseSpec(spec = "주방 정수기 호환 필터 세트 (사진 속 모델)", quantity = 1),
            seenBy = setOf(MOM, DAD),
            history = listOf(HistoryEntry(MOM, "부탁을 등록했어요", now.minusHours(5))),
            createdAt = now.minusHours(5),
        )

        // 3) 자녀가 방문 일정을 제안 — 부모님은 가능/조정/어려움으로 응답
        val visitPost = Post(
            id = "p3",
            authorId = MINSU,
            text = "이번 주말에 김장 도우러 갈게요! 다들 시간 괜찮으세요?",
            createdAt = now.minusDays(1),
            readBy = setOf(MINSU, MOM, DAD, JIEUN),
            linkedScheduleId = "s1",
        )
        val visitPlan = SchedulePlan(
            id = "s1",
            sourcePostId = "p3",
            proposerId = MINSU,
            title = "주말 김장하기",
            startAt = nextSaturday,
            place = "부모님 댁",
            audienceIds = everyone - MINSU,
            responses = mapOf(
                MOM to ScheduleResponse(MOM, Availability.AVAILABLE, null, 1, now.minusHours(20)),
                DAD to ScheduleResponse(DAD, Availability.RESCHEDULE, "오후 2시 이후가 좋겠다", 1, now.minusHours(18)),
            ),
            history = listOf(HistoryEntry(MINSU, "일정을 제안했어요", now.minusDays(1))),
            createdAt = now.minusDays(1),
        )

        // 4) 부모님이 자녀의 부탁을 맡은 예 — 역할을 고정하지 않는다.
        val checkupRequest = FamilyRequest(
            id = "r2",
            sourcePostId = null,
            requesterId = JIEUN,
            title = "엄마 건강검진 병원 예약 전화",
            detail = "다음 달 중에 평일 오전으로요.",
            dueDate = now.toLocalDate(),
            audienceIds = setOf(DAD, MINSU),
            assigneeId = DAD,
            status = RequestStatus.IN_PROGRESS,
            seenBy = setOf(JIEUN, DAD, MINSU),
            history = listOf(
                HistoryEntry(JIEUN, "부탁을 등록했어요", now.minusDays(2)),
                HistoryEntry(DAD, "제가 챙길게요", now.minusDays(2).plusHours(3)),
                HistoryEntry(DAD, "진행 중이에요", now.minusDays(1)),
            ),
            createdAt = now.minusDays(2),
        )

        // 5) 연결 없는 일상 소식
        val hikingPost = Post(
            id = "p4",
            authorId = DAD,
            text = "오늘 아침 동네 뒷산. 공기가 차가워졌다.",
            photoUris = listOf("sample:아침 산책길", "sample:산 정상 풍경"),
            createdAt = now.minusDays(1).minusHours(3),
            readBy = setOf(DAD, MOM),
        )

        return FamilyState(
            familyName = "우리집",
            inviteCode = "OURHOME-2026",
            members = members,
            currentUserId = MINSU,
            posts = listOf(flowerPost, filterPost, visitPost, hikingPost),
            requests = listOf(filterRequest, checkupRequest),
            schedules = listOf(visitPlan),
        )
    }
}
