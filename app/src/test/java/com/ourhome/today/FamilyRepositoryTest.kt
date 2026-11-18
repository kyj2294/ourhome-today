package com.ourhome.today

import com.ourhome.today.data.ActionResult
import com.ourhome.today.data.InMemoryFamilyRepository
import com.ourhome.today.data.RequestDraft
import com.ourhome.today.data.SampleData
import com.ourhome.today.data.SampleData.DAD
import com.ourhome.today.data.SampleData.JIEUN
import com.ourhome.today.data.SampleData.MINSU
import com.ourhome.today.data.SampleData.MOM
import com.ourhome.today.data.ScheduleDraft
import com.ourhome.today.data.TogetherFilter
import com.ourhome.today.data.TogetherItem
import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.PurchaseSpec
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.data.togetherItems
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDateTime

class FamilyRepositoryTest {

    private val now = LocalDateTime.of(2026, 11, 18, 9, 0)
    private lateinit var repo: InMemoryFamilyRepository

    @Before
    fun setUp() {
        repo = InMemoryFamilyRepository(SampleData.initialState(now)) { now }
    }

    private val state get() = repo.state.value
    private fun ActionResult.id(): String = (this as ActionResult.Ok).id!!

    @Test
    fun `일상 게시는 알림을 만들지 않는다`() {
        repo.switchUser(MOM)
        val before = state.notifications.size
        repo.createPost("오늘 점심은 칼국수", emptyList())
        assertEquals(before, state.notifications.size)
    }

    @Test
    fun `정수기 필터 흐름 - 게시 부탁 수락 주문 수령`() {
        // 1. 일상 공유
        repo.switchUser(MOM)
        val postId = repo.createPost("물맛이 달라졌네", listOf("sample:필터")).id()

        // 2. 글쓴이가 직접 부탁으로 연결 — 사진을 재업로드하지 않고 원글과 연결
        val requestId = repo.createRequest(
            RequestDraft(
                sourcePostId = postId,
                title = "정수기 필터 주문",
                audienceIds = state.otherMemberIds,
                purchase = PurchaseSpec("호환 필터", 2),
            ),
        ).id()
        assertEquals(requestId, state.post(postId)!!.linkedRequestId)
        assertEquals(RequestStatus.OPEN, state.request(requestId)!!.status)
        assertNull(state.request(requestId)!!.assigneeId)

        // 3. 자녀가 자발적으로 수락
        repo.switchUser(MINSU)
        assertTrue(repo.claimRequest(requestId) is ActionResult.Ok)
        assertEquals(MINSU, state.request(requestId)!!.assigneeId)

        // 다른 가족이 다시 맡으려 하면 현재 담당을 알려 준다
        repo.switchUser(JIEUN)
        val dup = repo.claimRequest(requestId)
        assertTrue(dup is ActionResult.Rejected)
        assertTrue((dup as ActionResult.Rejected).message.contains("민수"))

        // 4. 주문했어요 — 담당자만
        repo.switchUser(MINSU)
        assertTrue(repo.markInProgress(requestId) is ActionResult.Ok)
        assertEquals("주문했어요", state.request(requestId)!!.statusLabel)

        // 담당자가 '받았어요'로 완료할 수 없다 (주문과 수령 구분)
        assertTrue(repo.markDone(requestId) is ActionResult.Rejected)

        // 5. 요청자가 받았어요
        repo.switchUser(MOM)
        assertTrue(repo.markDone(requestId) is ActionResult.Ok)
        assertEquals(RequestStatus.DONE, state.request(requestId)!!.status)
        assertEquals("받았어요", state.request(requestId)!!.statusLabel)
    }

    @Test
    fun `남의 글은 부탁으로 바꿀 수 없다`() {
        repo.switchUser(MINSU)
        val result = repo.createRequest(RequestDraft("p1", "꽃 화분 사기", audienceIds = setOf(MOM)))
        assertTrue(result is ActionResult.Rejected)
        assertNull(state.post("p1")!!.linkedRequestId)
    }

    @Test
    fun `맡기 취소하면 담당 없음으로 돌아가고 요청자에게 알린다`() {
        repo.switchUser(MINSU)
        repo.claimRequest("r1")
        repo.releaseRequest("r1", "이번 주 출장")
        val r = state.request("r1")!!
        assertEquals(RequestStatus.OPEN, r.status)
        assertNull(r.assigneeId)
        assertTrue(state.notifications.any { it.recipientId == MOM && it.message.contains("이번 주 출장") })
    }

    @Test
    fun `일정 시간이 바뀌면 기존 응답은 재확인 대상이 된다`() {
        repo.switchUser(MINSU)
        val plan = state.schedule("s1")!!
        assertEquals(Availability.AVAILABLE, plan.currentResponse(MOM)!!.availability)

        repo.rescheduleSchedule("s1", plan.startAt.plusHours(4))
        val changed = state.schedule("s1")!!
        assertNull(changed.currentResponse(MOM))
        assertTrue(changed.needsReconfirm(MOM))
        assertFalse(changed.confirmed)

        repo.switchUser(MOM)
        repo.respondSchedule("s1", Availability.AVAILABLE, null)
        assertFalse(state.schedule("s1")!!.needsReconfirm(MOM))
    }

    @Test
    fun `제안자만 일정을 확정한다`() {
        repo.switchUser(MOM)
        assertTrue(repo.confirmSchedule("s1") is ActionResult.Rejected)
        repo.switchUser(MINSU)
        assertTrue(repo.confirmSchedule("s1") is ActionResult.Ok)
        assertTrue(state.schedule("s1")!!.confirmed)
    }

    @Test
    fun `응답 대기 필터는 내가 응답할 항목만 보여준다`() {
        repo.switchUser(DAD)
        val awaiting = state.togetherItems(TogetherFilter.AWAITING, now.toLocalDate())
        // 아빠: 담당 없는 r1(구매 부탁)은 응답 대기, s1은 이미 응답했으므로 제외
        assertTrue(awaiting.any { it is TogetherItem.Request && it.request.id == "r1" })
        assertFalse(awaiting.any { it is TogetherItem.Schedule })

        repo.switchUser(JIEUN)
        val jieun = state.togetherItems(TogetherFilter.AWAITING, now.toLocalDate())
        assertTrue(jieun.any { it is TogetherItem.Schedule && it.plan.id == "s1" })
    }

    @Test
    fun `일정 생성은 응답 요청 대상에게만 알린다`() {
        repo.switchUser(MOM)
        repo.createSchedule(
            ScheduleDraft(null, "아빠 생신 저녁", now.plusDays(10), "집", setOf(MINSU)),
        )
        val recipients = state.notifications.filter { it.message.contains("아빠 생신") }.map { it.recipientId }
        assertEquals(listOf(MINSU), recipients)
    }
}
