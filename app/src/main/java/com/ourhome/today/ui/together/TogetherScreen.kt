@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.together

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.TogetherFilter
import com.ourhome.today.data.TogetherItem
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.togetherItems
import com.ourhome.today.ui.components.RequestCard
import com.ourhome.today.ui.components.ScheduleCard
import com.ourhome.today.ui.notifications.NotificationBell
import java.time.LocalDate

/** 오늘 함께할 일: 일정과 부탁을 '오늘 · 응답 대기 · 진행 중'으로 찾는다. */
@Composable
fun TogetherScreen(
    state: FamilyState,
    onOpenRequest: (String) -> Unit,
    onOpenSchedule: (String) -> Unit,
    onNewRequest: () -> Unit,
    onNewSchedule: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf(TogetherFilter.AWAITING) }
    var menuOpen by rememberSaveable { mutableStateOf(false) }
    val items = state.togetherItems(filter, LocalDate.now())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("오늘 함께할 일") },
                actions = { NotificationBell(state.unreadNotificationCount, onOpenNotifications) },
            )
        },
        floatingActionButton = {
            Box {
                ExtendedFloatingActionButton(
                    onClick = { menuOpen = true },
                    icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                    text = { Text("새로 만들기") },
                )
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text("가족에게 부탁하기") },
                        leadingIcon = { Icon(Icons.Filled.Star, contentDescription = null) },
                        onClick = { menuOpen = false; onNewRequest() },
                    )
                    DropdownMenuItem(
                        text = { Text("일정 제안하기") },
                        leadingIcon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
                        onClick = { menuOpen = false; onNewSchedule() },
                    )
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TogetherFilter.entries.forEach { f ->
                    FilterChip(
                        selected = filter == f,
                        onClick = { filter = f },
                        label = { Text(f.label) },
                    )
                }
            }
            if (items.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text(
                        emptyMessage(filter),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(items, key = { it.key() }) { item ->
                        when (item) {
                            is TogetherItem.Request -> RequestCard(item.request, state, onClick = { onOpenRequest(item.request.id) })
                            is TogetherItem.Schedule -> ScheduleCard(item.plan, state, onClick = { onOpenSchedule(item.plan.id) })
                        }
                    }
                }
            }
        }
    }
}

private fun TogetherItem.key(): String = when (this) {
    is TogetherItem.Request -> "r_" + request.id
    is TogetherItem.Schedule -> "s_" + plan.id
}

private fun emptyMessage(filter: TogetherFilter) = when (filter) {
    TogetherFilter.TODAY -> "오늘 챙길 일정이나 부탁이 없어요"
    TogetherFilter.AWAITING -> "내가 응답할 항목이 없어요"
    TogetherFilter.IN_PROGRESS -> "진행 중인 일이 없어요"
    TogetherFilter.ALL -> "아직 함께할 일이 없어요.\n소식을 올리다가 필요할 때 부탁이나 일정으로 연결해 보세요."
}
