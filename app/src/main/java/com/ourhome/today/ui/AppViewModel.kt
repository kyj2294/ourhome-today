package com.ourhome.today.ui

import androidx.lifecycle.ViewModel
import com.ourhome.today.data.ActionResult
import com.ourhome.today.data.FamilyRepository
import com.ourhome.today.data.InMemoryFamilyRepository
import com.ourhome.today.data.RequestDraft
import com.ourhome.today.data.SampleData
import com.ourhome.today.data.ScheduleDraft
import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.PurchaseSpec
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 앱 전체에서 공유하는 ViewModel.
 * 프로토타입 단계라 하나로 두었고, 기능이 커지면 화면별 ViewModel로 나누면 된다.
 */
class AppViewModel(
    private val repo: FamilyRepository = InMemoryFamilyRepository(SampleData.initialState()),
) : ViewModel() {

    val state: StateFlow<FamilyState> = repo.state

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    /** 스낵바로 보여줄 안내 문구 (거절 사유 등) */
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    /** 결과가 거절이면 사유를 스낵바로 보내고 null, 성공이면 생성된 id(없으면 "")를 돌려준다. */
    private fun handle(result: ActionResult, success: String? = null): String? = when (result) {
        is ActionResult.Ok -> {
            success?.let { _messages.tryEmit(it) }
            result.id ?: ""
        }
        is ActionResult.Rejected -> {
            _messages.tryEmit(result.message)
            null
        }
    }

    fun switchUser(memberId: String) {
        repo.switchUser(memberId)
        _messages.tryEmit("${state.value.me.name} 입장으로 전환했어요")
    }

    fun createPost(text: String, photoUris: List<String>): String? =
        handle(repo.createPost(text, photoUris))

    fun markPostRead(postId: String) = repo.markPostRead(postId)
    fun addComment(postId: String, text: String): Boolean = handle(repo.addComment(postId, text)) != null

    fun createRequest(draft: RequestDraft): String? = handle(repo.createRequest(draft), "가족에게 부탁했어요")
    fun markRequestSeen(id: String) = repo.markRequestSeen(id)
    fun claimRequest(id: String) = handle(repo.claimRequest(id), "담당으로 표시했어요")
    fun releaseRequest(id: String, reason: String) = handle(repo.releaseRequest(id, reason), "맡기를 취소했어요")
    fun markInProgress(id: String) = handle(repo.markInProgress(id))
    fun markDone(id: String) = handle(repo.markDone(id))
    fun cancelRequest(id: String) = handle(repo.cancelRequest(id), "부탁을 취소했어요")
    fun updateRequest(id: String, detail: String, dueDate: LocalDate?, purchase: PurchaseSpec?) =
        handle(repo.updateRequest(id, detail, dueDate, purchase), "내용을 바꾸고 담당자에게 알렸어요")

    fun createSchedule(draft: ScheduleDraft): String? = handle(repo.createSchedule(draft), "일정을 제안했어요")
    fun respondSchedule(id: String, availability: Availability, note: String?) =
        handle(repo.respondSchedule(id, availability, note))
    fun rescheduleSchedule(id: String, newStartAt: LocalDateTime) =
        handle(repo.rescheduleSchedule(id, newStartAt), "시간을 바꾸고 다시 응답을 요청했어요")
    fun confirmSchedule(id: String) = handle(repo.confirmSchedule(id), "일정을 확정했어요")
    fun cancelSchedule(id: String) = handle(repo.cancelSchedule(id), "일정을 취소했어요")

    fun markMyNotificationsRead() = repo.markMyNotificationsRead()
}
