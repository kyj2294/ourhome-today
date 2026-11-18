package com.ourhome.today.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.FamilyRequest
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.Member
import com.ourhome.today.data.model.Post
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.data.model.SchedulePlan

/** 가족 구성원 아바타: 이름 첫 글자 + 고유 색 */
@Composable
fun MemberAvatar(member: Member?, size: Dp = 40.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(member?.let { Color(it.color) } ?: Color.Gray),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = member?.name?.take(1) ?: "?",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            style = if (size >= 40.dp) MaterialTheme.typography.titleMedium else MaterialTheme.typography.labelMedium,
        )
    }
}

/** 사진 한 장. "sample:" URI는 시연용 자리표시 이미지로 그린다. */
@Composable
fun PhotoBox(uri: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    if (uri.startsWith("sample:")) {
        Box(
            modifier = modifier
                .clip(shape)
                .background(
                    Brush.linearGradient(
                        listOf(MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.secondaryContainer),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "📷\n" + uri.removePrefix("sample:"),
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(12.dp),
            )
        }
    } else {
        AsyncImage(
            model = uri,
            contentDescription = "가족 사진",
            contentScale = ContentScale.Crop,
            modifier = modifier.clip(shape),
        )
    }
}

/** 게시물 사진들: 한 장이면 크게, 여러 장이면 가로로 넘겨 보기 */
@Composable
fun PhotoStrip(uris: List<String>, modifier: Modifier = Modifier) {
    when (uris.size) {
        0 -> Unit
        1 -> PhotoBox(uris.first(), modifier.fillMaxWidth().aspectRatio(4f / 3f))
        else -> Row(
            modifier = modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            uris.forEach { PhotoBox(it, Modifier.width(240.dp).aspectRatio(1f)) }
        }
    }
}

/** 작은 상태 배지 */
@Composable
fun StatusBadge(text: String, container: Color, content: Color) {
    Surface(color = container, contentColor = content, shape = RoundedCornerShape(50)) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
fun RequestStatusBadge(request: FamilyRequest) {
    val cs = MaterialTheme.colorScheme
    val (bg, fg) = when (request.status) {
        RequestStatus.OPEN -> cs.tertiaryContainer to cs.onTertiaryContainer
        RequestStatus.CLAIMED, RequestStatus.IN_PROGRESS -> cs.primaryContainer to cs.onPrimaryContainer
        RequestStatus.DONE -> cs.secondaryContainer to cs.onSecondaryContainer
        RequestStatus.CANCELED -> cs.surfaceVariant to cs.onSurfaceVariant
    }
    StatusBadge(request.statusLabel, bg, fg)
}

@Composable
fun ScheduleStatusBadge(plan: SchedulePlan) {
    val cs = MaterialTheme.colorScheme
    val (bg, fg) = when {
        plan.canceled -> cs.surfaceVariant to cs.onSurfaceVariant
        plan.confirmed -> cs.secondaryContainer to cs.onSecondaryContainer
        else -> cs.tertiaryContainer to cs.onTertiaryContainer
    }
    StatusBadge(plan.statusLabel, bg, fg)
}

/**
 * 부탁 한 줄 요약. 기획서 예시: "정수기 필터 부탁 | 다음 주까지 | 민수가 맡음 | 주문했어요"
 * 제목·희망 시점·담당·현재 상태를 목록에서 바로 읽게 한다.
 */
fun requestSummary(request: FamilyRequest, state: FamilyState): String {
    val assignee = request.assigneeId?.let { "${state.nameOf(it)}님이 맡음" } ?: "담당 없음"
    return listOf(Formatters.due(request.dueDate), assignee).joinToString(" · ")
}

fun scheduleSummary(plan: SchedulePlan): String {
    val available = plan.audienceIds.count { plan.currentResponse(it)?.availability == Availability.AVAILABLE }
    val waiting = plan.audienceIds.count { plan.currentResponse(it) == null }
    return listOf(
        Formatters.dateTime(plan.startAt),
        "가능 ${available}명",
        if (waiting > 0) "응답 대기 ${waiting}명" else "모두 응답",
    ).joinToString(" · ")
}

/** 부탁 카드 (목록·원글 연결 표시 공용) */
@Composable
fun RequestCard(request: FamilyRequest, state: FamilyState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    LinkedItemCard(
        icon = { Icon(if (request.isPurchase) Icons.Filled.ShoppingCart else Icons.Filled.Star, contentDescription = null) },
        kind = if (request.isPurchase) "구매 부탁" else "부탁",
        title = request.title,
        subtitle = "${state.nameOf(request.requesterId)}님 · " + requestSummary(request, state),
        badge = { RequestStatusBadge(request) },
        onClick = onClick,
        modifier = modifier,
    )
}

/** 일정 카드 (목록·원글 연결 표시 공용) */
@Composable
fun ScheduleCard(plan: SchedulePlan, state: FamilyState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val needsMe = state.currentUserId in plan.audienceIds && plan.currentResponse(state.currentUserId) == null && !plan.canceled
    LinkedItemCard(
        icon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
        kind = if (plan.needsReconfirm(state.currentUserId)) "일정 · 시간이 바뀌어 다시 확인해 주세요" else if (needsMe) "일정 · 내 응답 필요" else "일정",
        title = plan.title,
        subtitle = "${state.nameOf(plan.proposerId)}님 제안 · " + scheduleSummary(plan),
        badge = { ScheduleStatusBadge(plan) },
        onClick = onClick,
        modifier = modifier,
    )
}

@Composable
private fun LinkedItemCard(
    icon: @Composable () -> Unit,
    kind: String,
    title: String,
    subtitle: String,
    badge: @Composable () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        shape = RoundedCornerShape(16.dp),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) { icon() }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(kind, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            badge()
        }
    }
}

/** 원글 미리보기 (부탁·일정 상세에서 원래 사진과 글을 다시 보여준다) */
@Composable
fun SourcePostPreview(post: Post, state: FamilyState, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MemberAvatar(state.member(post.authorId), size = 28.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    "원글 · ${state.nameOf(post.authorId)} · ${Formatters.relative(post.createdAt)}",
                    style = MaterialTheme.typography.labelLarge,
                )
            }
            if (post.photoUris.isNotEmpty()) {
                PhotoBox(post.photoUris.first(), Modifier.fillMaxWidth().aspectRatio(16f / 9f))
            }
            if (post.text.isNotBlank()) {
                Text(post.text, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** 공유 대상(가족) 고르기 */
@Composable
fun AudiencePicker(
    state: FamilyState,
    selected: Set<String>,
    onChange: (Set<String>) -> Unit,
) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        state.members.filter { it.id != state.currentUserId }.forEach { m ->
            val isOn = m.id in selected
            FilterChip(
                selected = isOn,
                onClick = { onChange(if (isOn) selected - m.id else selected + m.id) },
                label = { Text(m.name) },
                leadingIcon = { MemberAvatar(m, size = 22.dp) },
            )
        }
    }
}

/** 섹션 제목 */
@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        modifier = modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}
