package com.ourhome.today.data.model

import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 우리집 오늘의 핵심 도메인 모델.
 *
 * 설계 원칙(기획서 기준)
 * - 가족 소식(Post)은 소식으로 끝나도 된다. 일정/부탁은 글쓴이가 직접 선택할 때만 연결된다.
 * - 읽음 / 의사 표현 / 담당 수락 / 처리 상태를 하나의 "확인" 버튼으로 합치지 않는다.
 * - 부모·자녀 역할을 권한으로 나누지 않는다. 항목마다 요청자·응답자·담당자가 달라진다.
 */

data class Member(
    val id: String,
    /** 가족 안에서 부르는 이름 (예: 엄마, 아빠, 민수) */
    val name: String,
    /** 관계 설명 (예: 어머니, 아들). 권한과는 무관하다. */
    val relation: String,
    /** 아바타 색상 (ARGB) */
    val color: Long,
)

data class Comment(
    val id: String,
    val authorId: String,
    val text: String,
    val createdAt: LocalDateTime,
)

/** 가족 소식(일상 게시물). 사진·짧은 글이 기본이며, 필요할 때만 일정/부탁이 연결된다. */
data class Post(
    val id: String,
    val authorId: String,
    val text: String,
    val photoUris: List<String> = emptyList(),
    val createdAt: LocalDateTime,
    /** 읽음은 '의사 표현'이나 '담당'과 별개로 기록한다. */
    val readBy: Set<String> = emptySet(),
    val comments: List<Comment> = emptyList(),
    val linkedRequestId: String? = null,
    val linkedScheduleId: String? = null,
) {
    val hasLinkedItem: Boolean get() = linkedRequestId != null || linkedScheduleId != null
}

/** 처리 이력 한 줄 (누가, 무엇을, 언제) */
data class HistoryEntry(
    val actorId: String,
    val message: String,
    val at: LocalDateTime,
)

// ---------------------------------------------------------------------------
// 부탁
// ---------------------------------------------------------------------------

/**
 * 부탁의 처리 상태.
 * 아직 맡은 사람 없음 → 제가 챙길게요(맡음) → 진행(주문했어요) → 완료(받았어요) / 취소
 */
enum class RequestStatus { OPEN, CLAIMED, IN_PROGRESS, DONE, CANCELED }

/** 구매 부탁일 때만 덧붙이는 정보 */
data class PurchaseSpec(
    val spec: String,
    val quantity: Int = 1,
)

data class FamilyRequest(
    val id: String,
    /** 이 부탁이 만들어진 원글. 원글의 사진·설명을 재사용한다. */
    val sourcePostId: String?,
    val requesterId: String,
    val title: String,
    val detail: String = "",
    val dueDate: LocalDate? = null,
    /** 부탁을 공유한 가족 (요청자 제외) */
    val audienceIds: Set<String>,
    val purchase: PurchaseSpec? = null,
    val assigneeId: String? = null,
    val status: RequestStatus = RequestStatus.OPEN,
    val seenBy: Set<String> = emptySet(),
    val history: List<HistoryEntry> = emptyList(),
    val createdAt: LocalDateTime,
) {
    val isPurchase: Boolean get() = purchase != null
    val isActive: Boolean
        get() = status == RequestStatus.OPEN ||
            status == RequestStatus.CLAIMED ||
            status == RequestStatus.IN_PROGRESS

    /** 목록에서 바로 읽히는 상태 문구 */
    val statusLabel: String
        get() = when (status) {
            RequestStatus.OPEN -> "아직 맡은 사람 없음"
            RequestStatus.CLAIMED -> "맡았어요"
            RequestStatus.IN_PROGRESS -> if (isPurchase) "주문했어요" else "진행 중"
            RequestStatus.DONE -> if (isPurchase) "받았어요" else "완료"
            RequestStatus.CANCELED -> "취소됨"
        }
}

// ---------------------------------------------------------------------------
// 일정
// ---------------------------------------------------------------------------

/** 일정에 대한 의사 표현. '읽음'과 구분된다. */
enum class Availability(val label: String) {
    AVAILABLE("가능해요"),
    RESCHEDULE("시간 바꿔요"),
    UNAVAILABLE("이번엔 어려워요"),
}

data class ScheduleResponse(
    val memberId: String,
    val availability: Availability,
    val note: String? = null,
    /** 어떤 일정 버전(날짜/시간)에 대한 응답인지. 시간이 바뀌면 재확인 대상이 된다. */
    val version: Int,
    val at: LocalDateTime,
)

data class SchedulePlan(
    val id: String,
    val sourcePostId: String?,
    val proposerId: String,
    val title: String,
    val startAt: LocalDateTime,
    val place: String? = null,
    /** 응답을 요청받은 가족 (제안자 제외) */
    val audienceIds: Set<String>,
    val responses: Map<String, ScheduleResponse> = emptyMap(),
    /** 날짜·시간이 바뀔 때마다 1씩 증가 */
    val version: Int = 1,
    val confirmed: Boolean = false,
    val canceled: Boolean = false,
    val history: List<HistoryEntry> = emptyList(),
    val createdAt: LocalDateTime,
) {
    /** 현재 버전에 대한 응답만 유효한 응답으로 본다. */
    fun currentResponse(memberId: String): ScheduleResponse? =
        responses[memberId]?.takeIf { it.version == version }

    /** 예전 시간에 응답했는데 시간이 바뀐 경우 → 재확인 필요 */
    fun needsReconfirm(memberId: String): Boolean =
        responses[memberId]?.let { it.version < version } ?: false

    val statusLabel: String
        get() = when {
            canceled -> "취소됨"
            confirmed -> "확정"
            else -> "조율 중"
        }
}

// ---------------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------------

sealed interface NotificationTarget {
    data class PostTarget(val postId: String) : NotificationTarget
    data class RequestTarget(val requestId: String) : NotificationTarget
    data class ScheduleTarget(val scheduleId: String) : NotificationTarget
}

/** 응답을 요청받은 사람·맡은 사람에게만 관련 변경을 알린다. 일상 소식에는 알림을 만들지 않는다. */
data class AppNotification(
    val id: String,
    val recipientId: String,
    val message: String,
    val target: NotificationTarget,
    val at: LocalDateTime,
    val read: Boolean = false,
)

// ---------------------------------------------------------------------------
// 전체 상태
// ---------------------------------------------------------------------------

data class FamilyState(
    val familyName: String,
    val inviteCode: String,
    val members: List<Member>,
    /** 현재 앱을 쓰는 가족 구성원 (프로토타입에서는 가족 화면에서 전환 가능) */
    val currentUserId: String,
    val posts: List<Post> = emptyList(),
    val requests: List<FamilyRequest> = emptyList(),
    val schedules: List<SchedulePlan> = emptyList(),
    val notifications: List<AppNotification> = emptyList(),
) {
    val me: Member get() = members.first { it.id == currentUserId }

    fun member(id: String?): Member? = members.firstOrNull { it.id == id }
    fun nameOf(id: String?): String = member(id)?.name ?: "알 수 없음"
    fun post(id: String?): Post? = posts.firstOrNull { it.id == id }
    fun request(id: String?): FamilyRequest? = requests.firstOrNull { it.id == id }
    fun schedule(id: String?): SchedulePlan? = schedules.firstOrNull { it.id == id }

    val myNotifications: List<AppNotification>
        get() = notifications.filter { it.recipientId == currentUserId }.sortedByDescending { it.at }

    val unreadNotificationCount: Int
        get() = notifications.count { it.recipientId == currentUserId && !it.read }

    /** 나를 제외한 가족 (공유 대상 기본값) */
    val otherMemberIds: Set<String>
        get() = members.map { it.id }.filter { it != currentUserId }.toSet()
}
