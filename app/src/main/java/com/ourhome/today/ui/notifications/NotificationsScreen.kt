@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.NotificationTarget
import com.ourhome.today.ui.components.Formatters

@Composable
fun NotificationBell(unread: Int, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        BadgedBox(badge = { if (unread > 0) Badge { Text("$unread") } }) {
            Icon(Icons.Filled.Notifications, contentDescription = "알림")
        }
    }
}

/**
 * 알림 목록. 응답을 요청받았거나 맡은 일에 관련된 변경만 온다.
 * 미접속·미응답을 위험 신호로 해석하는 '자동 안부 경고'는 만들지 않는다.
 */
@Composable
fun NotificationsScreen(
    state: FamilyState,
    onMarkAllRead: () -> Unit,
    onBack: () -> Unit,
    onOpen: (NotificationTarget) -> Unit,
) {
    // 화면에 들어왔을 때 보이는 목록을 고정해 두고, 나갈 때 읽음 처리한다.
    val list = remember(state.currentUserId) { state.myNotifications }
    DisposableEffect(state.currentUserId) { onDispose { onMarkAllRead() } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("알림") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                    }
                },
            )
        },
    ) { padding ->
        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("새 알림이 없어요", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(padding)) {
                items(list, key = { it.id }) { n ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onOpen(n.target) }.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(8.dp).background(
                                if (n.read) Color.Transparent else MaterialTheme.colorScheme.primary,
                                CircleShape,
                            ),
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(n.message, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                Formatters.relative(n.at),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
