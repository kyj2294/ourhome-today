package com.ourhome.today.data

import com.ourhome.today.data.model.FamilyRequest
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.data.model.SchedulePlan
import java.time.LocalDate
import java.time.LocalDateTime

/** '오늘 함께할 일' 화면의 찾기 기준 */
enum class TogetherFilter(val label: String) {
    TODAY("오늘"),
    AWAITING("응답 대기"),
    IN_PROGRESS("진행 중"),
    ALL("전체"),
}

/** '오늘 함께할 일'에 보이는 항목: 부탁 또는 일정 */
sealed interface TogetherItem {
    val sortKey: LocalDateTime

    data class Request(val request: FamilyRequest) : TogetherItem {
        override val sortKey: LocalDateTime
            get() = request.dueDate?.atStartOfDay() ?: request.createdAt
    }

    data class Schedule(val plan: SchedulePlan) : TogetherItem {
        override val sortKey: LocalDateTime get() = plan.startAt
    }
}

/**
 * 필터별 항목 목록.
 * - 오늘: 오늘(또는 지난) 기한의 진행 중 부탁, 오늘 일정
 * - 응답 대기: 내가 응답해야 하는 것 (담당 없는 부탁, 아직 응답 안 했거나 재확인이 필요한 일정)
 * - 진행 중: 누군가 맡은 부탁, 다가오는 일정
 */
fun FamilyState.togetherItems(filter: TogetherFilter, today: LocalDate): List<TogetherItem> {
    val me = currentUserId
    val upcomingSchedules = schedules.filter { !it.canceled && !it.startAt.toLocalDate().isBefore(today) }

    val items: List<TogetherItem> = when (filter) {
        TogetherFilter.TODAY ->
            requests.filter { it.isActive && it.dueDate != null && !it.dueDate.isAfter(today) }
                .map { TogetherItem.Request(it) } +
                upcomingSchedules.filter { it.startAt.toLocalDate() == today }
                    .map { TogetherItem.Schedule(it) }

        TogetherFilter.AWAITING ->
            requests.filter { it.status == RequestStatus.OPEN && me in it.audienceIds }
                .map { TogetherItem.Request(it) } +
                upcomingSchedules.filter { me in it.audienceIds && it.currentResponse(me) == null }
                    .map { TogetherItem.Schedule(it) }

        TogetherFilter.IN_PROGRESS ->
            requests.filter { it.status == RequestStatus.CLAIMED || it.status == RequestStatus.IN_PROGRESS }
                .map { TogetherItem.Request(it) } +
                upcomingSchedules.map { TogetherItem.Schedule(it) }

        TogetherFilter.ALL ->
            requests.map { TogetherItem.Request(it) } + schedules.map { TogetherItem.Schedule(it) }
    }
    return items.sortedBy { it.sortKey }
}
