package com.ourhome.today.data

import com.ourhome.today.data.model.AppNotification
import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.Comment
import com.ourhome.today.data.model.FamilyRequest
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.HistoryEntry
import com.ourhome.today.data.model.NotificationTarget
import com.ourhome.today.data.model.Post
import com.ourhome.today.data.model.PurchaseSpec
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.data.model.SchedulePlan
import com.ourhome.today.data.model.ScheduleResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

/**
 * 메모리에서 동작하는 프로토타입 저장소. 앱을 끄면 데이터가 초기화된다.
 * 비즈니스 규칙(누가 무엇을 할 수 있는지, 누구에게 알릴지)은 모두 여기에 모여 있다.
 */
class InMemoryFamilyRepository(
    initial: FamilyState,
    private val clock: () -> LocalDateTime = { LocalDateTime.now() },
) : FamilyRepository {

    private val _state = MutableStateFlow(initial)
    override val state: StateFlow<FamilyState> = _state.asStateFlow()

    private val seq = AtomicLong(1000)
    private fun newId(prefix: String) = "$prefix${seq.incrementAndGet()}"

    private val s: FamilyState get() = _state.value
    private val me: String get() = s.currentUserId

    private fun ok(id: String? = null) = ActionResult.Ok(id)
    private fun reject(message: String) = ActionResult.Rejected(message)

    // -----------------------------------------------------------------------
    // 공통 헬퍼
    // -----------------------------------------------------------------------

    private fun notify(
        recipients: Collection<String>,
        message: String,
        target: NotificationTarget,
    ): List<AppNotification> = recipients
        .filter { it != me }
        .distinct()
        .map { AppNotification(newId("n"), it, message, target, clock()) }

    private fun FamilyState.withNotifications(list: List<AppNotification>) =
        copy(notifications = notifications + list)

    private fun updateRequestState(
        requestId: String,
        transform: (FamilyRequest) -> FamilyRequest,
        notifications: (FamilyRequest) -> List<AppNotification> = { emptyList() },
    ) {
        _state.value = s.let { st ->
            val updated = transform(st.request(requestId)!!)
            st.copy(requests = st.requests.map { if (it.id == requestId) updated else it })
                .withNotifications(notifications(updated))
        }
    }

    private fun updateScheduleState(
        scheduleId: String,
        transform: (SchedulePlan) -> SchedulePlan,
        notifications: (SchedulePlan) -> List<AppNotification> = { emptyList() },
    ) {
        _state.value = s.let { st ->
            val updated = transform(st.schedule(scheduleId)!!)
            st.copy(schedules = st.schedules.map { if (it.id == scheduleId) updated else it })
                .withNotifications(notifications(updated))
        }
    }

    private fun entry(message: String) = HistoryEntry(me, message, clock())
    private val myName: String get() = s.nameOf(me)

    // -----------------------------------------------------------------------
    // 사용자 / 가족 소식
    // -----------------------------------------------------------------------

    override fun switchUser(memberId: String) {
        if (s.member(memberId) != null) _state.value = s.copy(currentUserId = memberId)
    }

    override fun createPost(text: String, photoUris: List<String>): ActionResult {
        if (text.isBlank() && photoUris.isEmpty()) return reject("사진이나 글을 넣어 주세요.")
        val post = Post(
            id = newId("p"),
            authorId = me,
            text = text.trim(),
            photoUris = photoUris,
            createdAt = clock(),
            readBy = setOf(me),
        )
        // 일상 소식에는 알림을 만들지 않는다. (기획서: 모든 소식에 알림을 보내지 않음)
        _state.value = s.copy(posts = listOf(post) + s.posts)
        return ok(post.id)
    }

    override fun markPostRead(postId: String) {
        val post = s.post(postId) ?: return
        if (me in post.readBy) return
        _state.value = s.copy(posts = s.posts.map { if (it.id == postId) it.copy(readBy = it.readBy + me) else it })
    }

    override fun addComment(postId: String, text: String): ActionResult {
        if (text.isBlank()) return reject("댓글을 입력해 주세요.")
        val post = s.post(postId) ?: return reject("게시물을 찾을 수 없어요.")
        val comment = Comment(newId("c"), me, text.trim(), clock())
        _state.value = s.copy(
            posts = s.posts.map { if (it.id == postId) it.copy(comments = it.comments + comment) else it },
        ).withNotifications(
            notify(listOf(post.authorId), "${myName}님이 댓글을 남겼어요: ${text.trim().take(30)}", NotificationTarget.PostTarget(postId)),
        )
        return ok(comment.id)
    }

    // -----------------------------------------------------------------------
    // 부탁
    // -----------------------------------------------------------------------

    override fun createRequest(draft: RequestDraft): ActionResult {
        if (draft.title.isBlank()) return reject("무엇을 부탁하는지 적어 주세요.")
        if (draft.audienceIds.isEmpty()) return reject("부탁을 공유할 가족을 한 명 이상 골라 주세요.")
        draft.purchase?.let { if (it.quantity < 1) return reject("수량은 1개 이상이어야 해요.") }

        val source = draft.sourcePostId?.let { s.post(it) ?: return reject("원글을 찾을 수 없어요.") }
        if (source != null) {
            // 부탁 여부는 글쓴이가 직접 선택한다. 다른 사람이 남의 글을 부탁으로 바꾸지 않는다.
            if (source.authorId != me) return reject("내가 올린 글만 부탁으로 연결할 수 있어요.")
            if (source.hasLinkedItem) return reject("이미 일정이나 부탁이 연결된 글이에요.")
        }

        val request = FamilyRequest(
            id = newId("r"),
            sourcePostId = source?.id,
            requesterId = me,
            title = draft.title.trim(),
            detail = draft.detail.trim(),
            dueDate = draft.dueDate,
            audienceIds = draft.audienceIds - me,
            purchase = draft.purchase,
            seenBy = setOf(me),
            history = listOf(entry("부탁을 등록했어요")),
            createdAt = clock(),
        )
        _state.value = s.copy(
            requests = listOf(request) + s.requests,
            posts = s.posts.map { if (it.id == source?.id) it.copy(linkedRequestId = request.id) else it },
        ).withNotifications(
            notify(request.audienceIds, "${myName}님의 부탁: ${request.title}", NotificationTarget.RequestTarget(request.id)),
        )
        return ok(request.id)
    }

    override fun markRequestSeen(requestId: String) {
        val r = s.request(requestId) ?: return
        if (me in r.seenBy) return
        updateRequestState(requestId, { it.copy(seenBy = it.seenBy + me) })
    }

    override fun claimRequest(requestId: String): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.requesterId == me) return reject("내가 한 부탁은 직접 맡을 수 없어요.")
        if (me !in r.audienceIds) return reject("나에게 공유된 부탁이 아니에요.")
        // 중복 수락 방지: 이미 다른 사람이 맡았으면 현재 담당자를 알려 준다.
        if (r.assigneeId != null && r.assigneeId != me) {
            return reject("${s.nameOf(r.assigneeId)}님이 이미 맡았어요.")
        }
        if (r.status != RequestStatus.OPEN) return reject("지금은 맡을 수 없는 상태예요. (${r.statusLabel})")

        updateRequestState(
            requestId,
            { it.copy(assigneeId = me, status = RequestStatus.CLAIMED, history = it.history + entry("제가 챙길게요")) },
            { notify(listOf(it.requesterId), "${myName}님이 '${it.title}'을(를) 맡았어요", NotificationTarget.RequestTarget(it.id)) },
        )
        return ok()
    }

    override fun releaseRequest(requestId: String, reason: String): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.assigneeId != me) return reject("내가 맡은 부탁만 맡기를 취소할 수 있어요.")
        if (r.status != RequestStatus.CLAIMED && r.status != RequestStatus.IN_PROGRESS) {
            return reject("지금은 맡기를 취소할 수 없어요.")
        }
        val why = reason.trim().ifBlank { "사유 없음" }
        updateRequestState(
            requestId,
            {
                it.copy(
                    assigneeId = null,
                    status = RequestStatus.OPEN,
                    history = it.history + entry("맡기 취소 · $why"),
                )
            },
            {
                notify(
                    listOf(it.requesterId),
                    "${myName}님이 '${it.title}' 맡기를 취소했어요 ($why). 다시 담당 없음 상태예요.",
                    NotificationTarget.RequestTarget(it.id),
                )
            },
        )
        return ok()
    }

    override fun markInProgress(requestId: String): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.assigneeId != me) return reject("담당자만 진행 상태를 바꿀 수 있어요.")
        if (r.status != RequestStatus.CLAIMED) return reject("지금은 진행 상태로 바꿀 수 없어요.")
        val label = if (r.isPurchase) "주문했어요" else "진행 중이에요"
        updateRequestState(
            requestId,
            { it.copy(status = RequestStatus.IN_PROGRESS, history = it.history + entry(label)) },
            { notify(listOf(it.requesterId), "'${it.title}' · ${myName}님: $label", NotificationTarget.RequestTarget(it.id)) },
        )
        return ok()
    }

    override fun markDone(requestId: String): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.isPurchase) {
            // 주문과 수령을 구분한다. 받기 전에는 완료 처리하지 않으며, 받은 사람(요청자)이 확인한다.
            if (r.requesterId != me) return reject("구매 부탁은 물건을 받은 요청자가 '받았어요'로 완료해요.")
            if (r.status != RequestStatus.IN_PROGRESS) return reject("주문 후에 받았어요를 누를 수 있어요.")
        } else {
            if (r.requesterId != me && r.assigneeId != me) return reject("요청자나 담당자만 완료할 수 있어요.")
            if (r.status != RequestStatus.CLAIMED && r.status != RequestStatus.IN_PROGRESS) {
                return reject("맡은 사람이 있어야 완료할 수 있어요.")
            }
        }
        val label = if (r.isPurchase) "받았어요" else "완료했어요"
        updateRequestState(
            requestId,
            { it.copy(status = RequestStatus.DONE, history = it.history + entry(label)) },
            {
                notify(
                    listOfNotNull(it.requesterId, it.assigneeId),
                    "'${it.title}' · ${myName}님: $label",
                    NotificationTarget.RequestTarget(it.id),
                )
            },
        )
        return ok()
    }

    override fun cancelRequest(requestId: String): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.requesterId != me) return reject("부탁한 사람만 취소할 수 있어요.")
        if (!r.isActive) return reject("이미 끝난 부탁이에요.")
        updateRequestState(
            requestId,
            { it.copy(status = RequestStatus.CANCELED, history = it.history + entry("부탁을 취소했어요")) },
            { notify(listOfNotNull(it.assigneeId), "'${it.title}' 부탁이 취소됐어요", NotificationTarget.RequestTarget(it.id)) },
        )
        return ok()
    }

    override fun updateRequest(
        requestId: String,
        detail: String,
        dueDate: LocalDate?,
        purchase: PurchaseSpec?,
    ): ActionResult {
        val r = s.request(requestId) ?: return reject("부탁을 찾을 수 없어요.")
        if (r.requesterId != me) return reject("부탁한 사람만 내용을 바꿀 수 있어요.")
        if (!r.isActive) return reject("이미 끝난 부탁은 바꿀 수 없어요.")
        if (r.isPurchase && purchase == null) return reject("구매 정보를 비울 수 없어요.")
        purchase?.let { if (it.quantity < 1) return reject("수량은 1개 이상이어야 해요.") }
        updateRequestState(
            requestId,
            {
                it.copy(
                    detail = detail.trim(),
                    dueDate = dueDate,
                    purchase = if (it.isPurchase) purchase else null,
                    history = it.history + entry("내용을 바꿨어요"),
                )
            },
            // 통화로 바뀐 내용이 자동 반영된다고 가정하지 않는다. 원래 항목을 고치면 담당자에게 알린다.
            { notify(listOfNotNull(it.assigneeId), "'${it.title}' 내용이 바뀌었어요. 확인해 주세요.", NotificationTarget.RequestTarget(it.id)) },
        )
        return ok()
    }

    // -----------------------------------------------------------------------
    // 일정
    // -----------------------------------------------------------------------

    override fun createSchedule(draft: ScheduleDraft): ActionResult {
        if (draft.title.isBlank()) return reject("일정 이름을 적어 주세요.")
        if (draft.audienceIds.isEmpty()) return reject("응답을 요청할 가족을 한 명 이상 골라 주세요.")
        val source = draft.sourcePostId?.let { s.post(it) ?: return reject("원글을 찾을 수 없어요.") }
        if (source != null) {
            if (source.authorId != me) return reject("내가 올린 글만 일정으로 연결할 수 있어요.")
            if (source.hasLinkedItem) return reject("이미 일정이나 부탁이 연결된 글이에요.")
        }
        val plan = SchedulePlan(
            id = newId("s"),
            sourcePostId = source?.id,
            proposerId = me,
            title = draft.title.trim(),
            startAt = draft.startAt,
            place = draft.place?.trim()?.ifBlank { null },
            audienceIds = draft.audienceIds - me,
            history = listOf(entry("일정을 제안했어요 · ${draft.startAt.format(HISTORY_TIME)}")),
            createdAt = clock(),
        )
        _state.value = s.copy(
            schedules = listOf(plan) + s.schedules,
            posts = s.posts.map { if (it.id == source?.id) it.copy(linkedScheduleId = plan.id) else it },
        ).withNotifications(
            notify(plan.audienceIds, "${myName}님의 일정 제안: ${plan.title}", NotificationTarget.ScheduleTarget(plan.id)),
        )
        return ok(plan.id)
    }

    override fun respondSchedule(scheduleId: String, availability: Availability, note: String?): ActionResult {
        val p = s.schedule(scheduleId) ?: return reject("일정을 찾을 수 없어요.")
        if (p.canceled) return reject("취소된 일정이에요.")
        if (me !in p.audienceIds) return reject("응답을 요청받은 일정이 아니에요.")
        val response = ScheduleResponse(me, availability, note?.trim()?.ifBlank { null }, p.version, clock())
        updateScheduleState(
            scheduleId,
            { it.copy(responses = it.responses + (me to response), history = it.history + entry(availability.label)) },
            { notify(listOf(it.proposerId), "'${it.title}' · ${myName}님: ${availability.label}", NotificationTarget.ScheduleTarget(it.id)) },
        )
        return ok()
    }

    override fun rescheduleSchedule(scheduleId: String, newStartAt: LocalDateTime): ActionResult {
        val p = s.schedule(scheduleId) ?: return reject("일정을 찾을 수 없어요.")
        if (p.proposerId != me) return reject("제안한 사람만 시간을 바꿀 수 있어요.")
        if (p.canceled) return reject("취소된 일정이에요.")
        if (newStartAt == p.startAt) return reject("기존과 같은 시간이에요.")
        updateScheduleState(
            scheduleId,
            {
                // 시간이 바뀌면 기존 '가능해요' 응답을 그대로 재사용하지 않고 재확인 대상으로 둔다.
                it.copy(
                    startAt = newStartAt,
                    version = it.version + 1,
                    confirmed = false,
                    history = it.history + entry("시간을 바꿨어요 → ${newStartAt.format(HISTORY_TIME)}"),
                )
            },
            { notify(it.audienceIds, "'${it.title}' 시간이 바뀌었어요. 다시 응답해 주세요.", NotificationTarget.ScheduleTarget(it.id)) },
        )
        return ok()
    }

    override fun confirmSchedule(scheduleId: String): ActionResult {
        val p = s.schedule(scheduleId) ?: return reject("일정을 찾을 수 없어요.")
        if (p.proposerId != me) return reject("제안한 사람이 일정을 확정해요.")
        if (p.canceled) return reject("취소된 일정이에요.")
        if (p.confirmed) return reject("이미 확정된 일정이에요.")
        updateScheduleState(
            scheduleId,
            { it.copy(confirmed = true, history = it.history + entry("일정을 확정했어요")) },
            { notify(it.audienceIds, "'${it.title}' 일정이 확정됐어요 · ${it.startAt.format(HISTORY_TIME)}", NotificationTarget.ScheduleTarget(it.id)) },
        )
        return ok()
    }

    override fun cancelSchedule(scheduleId: String): ActionResult {
        val p = s.schedule(scheduleId) ?: return reject("일정을 찾을 수 없어요.")
        if (p.proposerId != me) return reject("제안한 사람만 취소할 수 있어요.")
        if (p.canceled) return reject("이미 취소된 일정이에요.")
        updateScheduleState(
            scheduleId,
            { it.copy(canceled = true, confirmed = false, history = it.history + entry("일정을 취소했어요")) },
            { notify(it.audienceIds, "'${it.title}' 일정이 취소됐어요", NotificationTarget.ScheduleTarget(it.id)) },
        )
        return ok()
    }

    // -----------------------------------------------------------------------
    // 알림
    // -----------------------------------------------------------------------

    override fun markMyNotificationsRead() {
        if (s.notifications.none { it.recipientId == me && !it.read }) return
        _state.value = s.copy(
            notifications = s.notifications.map { if (it.recipientId == me) it.copy(read = true) else it },
        )
    }

    private companion object {
        val HISTORY_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("M월 d일 (E) a h:mm", Locale.KOREAN)
    }
}
