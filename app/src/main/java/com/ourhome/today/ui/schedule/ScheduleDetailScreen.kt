@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.schedule

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.Availability
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.SchedulePlan
import com.ourhome.today.ui.AppViewModel
import com.ourhome.today.ui.components.Formatters
import com.ourhome.today.ui.components.MemberAvatar
import com.ourhome.today.ui.components.ScheduleStatusBadge
import com.ourhome.today.ui.components.SectionTitle
import com.ourhome.today.ui.components.SourcePostPreview
import com.ourhome.today.ui.components.StatusBadge
import java.time.LocalDateTime

/**
 * 일정 상세.
 * - 응답: 가능해요 · 시간 바꿔요 · 이번엔 어려워요
 * - 제안자가 시간을 바꾸면 기존 응답은 '재확인 필요'로 표시된다.
 * - 제안자가 일정을 확정한다.
 */
@Composable
fun ScheduleDetailScreen(
    state: FamilyState,
    scheduleId: String,
    vm: AppViewModel,
    onBack: () -> Unit,
    onOpenPost: (String) -> Unit,
) {
    val plan = state.schedule(scheduleId)
    var showReschedule by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("일정") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
            )
        },
    ) { padding ->
        if (plan == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("일정을 찾을 수 없어요") }
            return@Scaffold
        }
        val me = state.currentUserId
        val isProposer = plan.proposerId == me

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(plan.title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                    ScheduleStatusBadge(plan)
                }
            }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(Formatters.dateTime(plan.startAt), style = MaterialTheme.typography.titleMedium)
                        plan.place?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
                        Text(
                            "${state.nameOf(plan.proposerId)}님 제안",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            plan.sourcePostId?.let { state.post(it) }?.let { post ->
                item { SourcePostPreview(post, state, onClick = { onOpenPost(post.id) }) }
            }

            // 내 응답
            if (me in plan.audienceIds && !plan.canceled) {
                item { MyResponse(plan, me, vm) }
            }

            // 제안자 전용
            if (isProposer && !plan.canceled) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!plan.confirmed) {
                            Button(
                                onClick = { vm.confirmSchedule(plan.id) },
                                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                            ) { Text("이 시간으로 확정하기") }
                        }
                        OutlinedButton(onClick = { showReschedule = true }, modifier = Modifier.fillMaxWidth()) {
                            Text("시간 바꾸기")
                        }
                        TextButton(onClick = { vm.cancelSchedule(plan.id) }) { Text("일정 취소하기") }
                    }
                }
            }

            item { SectionTitle("가족 응답") }
            items(plan.audienceIds.toList(), key = { it }) { memberId ->
                ResponseRow(plan, memberId, state)
            }
        }
    }

    if (showReschedule && plan != null) {
        RescheduleDialog(
            current = plan.startAt,
            onDismiss = { showReschedule = false },
            onConfirm = { newTime ->
                if (vm.rescheduleSchedule(plan.id, newTime) != null) showReschedule = false
            },
        )
    }
}

@Composable
private fun MyResponse(plan: SchedulePlan, me: String, vm: AppViewModel) {
    val current = plan.currentResponse(me)?.availability
    var note by rememberSaveable(plan.version) { mutableStateOf(plan.currentResponse(me)?.note.orEmpty()) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("내 응답", style = MaterialTheme.typography.titleMedium)
            if (plan.needsReconfirm(me)) {
                Text(
                    "시간이 바뀌었어요. 바뀐 시간 기준으로 다시 알려 주세요.",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            val options = Availability.entries
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                options.forEachIndexed { index, option ->
                    SegmentedButton(
                        selected = current == option,
                        onClick = { vm.respondSchedule(plan.id, option, note) },
                        shape = SegmentedButtonDefaults.itemShape(index, options.size),
                    ) { Text(option.label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                }
            }
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("한마디 (선택) 예: 오후 2시 이후가 좋아요") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (current != null) {
                TextButton(onClick = { vm.respondSchedule(plan.id, current, note) }) { Text("한마디 저장") }
            }
        }
    }
}

@Composable
private fun ResponseRow(plan: SchedulePlan, memberId: String, state: FamilyState) {
    val response = plan.currentResponse(memberId)
    val cs = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        MemberAvatar(state.member(memberId), size = 32.dp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(state.nameOf(memberId), style = MaterialTheme.typography.bodyLarge)
            response?.note?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant)
            }
        }
        when {
            response != null -> {
                val (bg, fg) = when (response.availability) {
                    Availability.AVAILABLE -> cs.secondaryContainer to cs.onSecondaryContainer
                    Availability.RESCHEDULE -> cs.tertiaryContainer to cs.onTertiaryContainer
                    Availability.UNAVAILABLE -> cs.surfaceVariant to cs.onSurfaceVariant
                }
                StatusBadge(response.availability.label, bg, fg)
            }
            // 미응답을 무관심으로 해석하지 않는다. 그냥 '아직 응답 전'이다.
            plan.needsReconfirm(memberId) -> StatusBadge("재확인 필요", cs.errorContainer, cs.onErrorContainer)
            else -> StatusBadge("아직 응답 전", cs.surfaceVariant, cs.onSurfaceVariant)
        }
    }
}

@Composable
private fun RescheduleDialog(
    current: LocalDateTime,
    onDismiss: () -> Unit,
    onConfirm: (LocalDateTime) -> Unit,
) {
    var newTime by rememberSaveable { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("시간 바꾸기") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("바꾸면 기존 응답은 '재확인 필요'로 바뀌고 가족에게 다시 응답을 요청해요.")
                DateTimeField(newTime, onChange = { newTime = it })
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(newTime) }) { Text("바꾸기") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("닫기") } },
    )
}
