@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.post

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.ui.components.Formatters
import com.ourhome.today.ui.components.MemberAvatar
import com.ourhome.today.ui.components.PhotoStrip
import com.ourhome.today.ui.components.RequestCard
import com.ourhome.today.ui.components.ScheduleCard
import com.ourhome.today.ui.components.SectionTitle

@Composable
fun PostDetailScreen(
    state: FamilyState,
    postId: String,
    onBack: () -> Unit,
    onMarkRead: () -> Unit,
    onAddComment: (String) -> Boolean,
    onLinkRequest: () -> Unit,
    onLinkSchedule: () -> Unit,
    onOpenRequest: (String) -> Unit,
    onOpenSchedule: (String) -> Unit,
) {
    val post = state.post(postId)
    LaunchedEffect(postId, state.currentUserId) { onMarkRead() }
    var comment by rememberSaveable { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("가족 소식") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
            )
        },
        bottomBar = {
            if (post != null) {
                Surface(tonalElevation = 3.dp) {
                    Row(
                        Modifier.fillMaxWidth().imePadding().padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedTextField(
                            value = comment,
                            onValueChange = { comment = it },
                            placeholder = { Text("댓글 남기기") },
                            modifier = Modifier.weight(1f),
                            maxLines = 3,
                        )
                        IconButton(onClick = { if (onAddComment(comment)) comment = "" }) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "보내기")
                        }
                    }
                }
            }
        },
    ) { padding ->
        if (post == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("게시물을 찾을 수 없어요") }
            return@Scaffold
        }
        val isMine = post.authorId == state.currentUserId
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MemberAvatar(state.member(post.authorId))
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(state.nameOf(post.authorId), style = MaterialTheme.typography.titleMedium)
                        Text(Formatters.relative(post.createdAt), style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            item { PhotoStrip(post.photoUris) }
            if (post.text.isNotBlank()) {
                item { Text(post.text, style = MaterialTheme.typography.bodyLarge) }
            }

            // 연결된 부탁/일정 — 또는 글쓴이에게만 연결 버튼을 보여준다.
            item {
                val request = state.request(post.linkedRequestId)
                val schedule = state.schedule(post.linkedScheduleId)
                when {
                    request != null -> RequestCard(request, state, onClick = { onOpenRequest(request.id) })
                    schedule != null -> ScheduleCard(schedule, state, onClick = { onOpenSchedule(schedule.id) })
                    isMine -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            "필요하면 이 글의 사진·설명 그대로 가족에게 부탁하거나 일정을 제안할 수 있어요.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = onLinkRequest) {
                                Icon(Icons.Filled.Star, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text("가족에게 부탁")
                            }
                            OutlinedButton(onClick = onLinkSchedule) {
                                Icon(Icons.Filled.DateRange, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text("일정 제안")
                            }
                        }
                    }
                    else -> Unit
                }
            }

            // 읽음은 의사 표현이 아니다 — 누가 봤는지만 조용히 보여준다.
            item {
                Text(
                    "읽은 가족: " + post.readBy.joinToString { state.nameOf(it) },
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item { HorizontalDivider() }
            item { SectionTitle("댓글 ${post.comments.size}") }
            items(post.comments, key = { it.id }) { c ->
                Row(verticalAlignment = Alignment.Top) {
                    MemberAvatar(state.member(c.authorId), size = 32.dp)
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            "${state.nameOf(c.authorId)} · ${Formatters.relative(c.createdAt)}",
                            style = MaterialTheme.typography.labelLarge,
                        )
                        Text(c.text, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}
