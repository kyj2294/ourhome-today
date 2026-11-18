package com.ourhome.today.data

import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.PurchaseSpec
import kotlinx.coroutines.flow.StateFlow
import java.time.LocalDate
import java.time.LocalDateTime

/** 사용자 행동의 결과. 거절 시 사용자에게 보여줄 문구를 담는다. */
sealed interface ActionResult {
    data class Ok(val id: String? = null) : ActionResult
    data class Rejected(val message: String) : ActionResult
}

data class RequestDraft(
    val sourcePostId: String?,
    val title: String,
    val detail: String = "",
    val dueDate: LocalDate? = null,
    val audienceIds: Set<String>,
    val purchase: PurchaseSpec? = null,
)

data class ScheduleDraft(
    val sourcePostId: String?,
    val title: String,
    val startAt: LocalDateTime,
    val place: String? = null,
    val audienceIds: Set<String>,
)

/**
 * 가족 데이터 저장소.
 *
 * 지금은 [InMemoryFamilyRepository]가 메모리에서 동작하는 프로토타입 구현이다.
 * 서버(Firebase, Supabase 등)를 붙일 때는 이 인터페이스의 새 구현만 만들면 화면 코드는 그대로 쓸 수 있다.
 * 특히 [claimRequest]의 중복 수락 방지는 서버에서 트랜잭션(조건부 업데이트)으로 보장해야 한다.
 */
interface FamilyRepository {
    val state: StateFlow<FamilyState>

    /** 프로토타입 전용: 다른 가족 구성원 입장으로 전환해 흐름을 시험한다. */
    fun switchUser(memberId: String)

    // 가족 소식
    fun createPost(text: String, photoUris: List<String>): ActionResult
    fun markPostRead(postId: String)
    fun addComment(postId: String, text: String): ActionResult

    // 부탁
    fun createRequest(draft: RequestDraft): ActionResult
    fun markRequestSeen(requestId: String)
    fun claimRequest(requestId: String): ActionResult
    fun releaseRequest(requestId: String, reason: String): ActionResult
    fun markInProgress(requestId: String): ActionResult
    fun markDone(requestId: String): ActionResult
    fun cancelRequest(requestId: String): ActionResult
    fun updateRequest(
        requestId: String,
        detail: String,
        dueDate: LocalDate?,
        purchase: PurchaseSpec?,
    ): ActionResult

    // 일정
    fun createSchedule(draft: ScheduleDraft): ActionResult
    fun respondSchedule(scheduleId: String, availability: Availability, note: String?): ActionResult
    fun rescheduleSchedule(scheduleId: String, newStartAt: LocalDateTime): ActionResult
    fun confirmSchedule(scheduleId: String): ActionResult
    fun cancelSchedule(scheduleId: String): ActionResult

    // 알림
    fun markMyNotificationsRead()
}
