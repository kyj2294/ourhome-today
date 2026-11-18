@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.feed

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.Post
import com.ourhome.today.ui.components.Formatters
import com.ourhome.today.ui.components.MemberAvatar
import com.ourhome.today.ui.components.PhotoStrip
import com.ourhome.today.ui.components.RequestCard
import com.ourhome.today.ui.components.ScheduleCard
import com.ourhome.today.ui.notifications.NotificationBell

/**
 * 가족 소식 (홈 첫 화면)
 * 사진·짧은 글이 중심이다. 부탁이 연결된 글만 아래에 연결 항목의 '최신 상태'를 함께 보여준다.
 */
@Composable
fun FeedScreen(
    state: FamilyState,
    onOpenPost: (String) -> Unit,
    onOpenRequest: (String) -> Unit,
    onOpenSchedule: (String) -> Unit,
    onCompose: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("우리집 오늘")
                        Text(
                            "${state.familyName} · ${state.me.name}(으)로 보는 중",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = { NotificationBell(state.unreadNotificationCount, onOpenNotifications) },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onCompose,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("소식 올리기") },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(state.posts.sortedByDescending { it.createdAt }, key = { it.id }) { post ->
                PostCard(
                    post = post,
                    state = state,
                    onClick = { onOpenPost(post.id) },
                    onOpenRequest = onOpenRequest,
                    onOpenSchedule = onOpenSchedule,
                )
            }
        }
    }
}

@Composable
fun PostCard(
    post: Post,
    state: FamilyState,
    onClick: () -> Unit,
    onOpenRequest: (String) -> Unit,
    onOpenSchedule: (String) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val author = state.member(post.authorId)
                MemberAvatar(author)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(author?.name ?: "", style = MaterialTheme.typography.titleMedium)
                    Text(
                        Formatters.relative(post.createdAt),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            PhotoStrip(post.photoUris)
            if (post.text.isNotBlank()) {
                Text(post.text, style = MaterialTheme.typography.bodyLarge, maxLines = 6, overflow = TextOverflow.Ellipsis)
            }
            // 원글과 연결된 부탁/일정: 담당·상태가 바뀌면 여기서도 같은 최신 정보를 보여준다.
            post.linkedRequestId?.let { state.request(it) }?.let { r ->
                RequestCard(r, state, onClick = { onOpenRequest(r.id) })
            }
            post.linkedScheduleId?.let { state.schedule(it) }?.let { p ->
                ScheduleCard(p, state, onClick = { onOpenSchedule(p.id) })
            }
            // 읽음은 의사 표현·담당과 별개로 표시한다.
            Text(
                buildString {
                    append("읽음 ${post.readBy.size}명")
                    if (post.comments.isNotEmpty()) append(" · 댓글 ${post.comments.size}")
                },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
