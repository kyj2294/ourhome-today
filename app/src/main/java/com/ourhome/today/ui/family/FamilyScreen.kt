@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.family

import android.content.Intent
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
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.ui.components.MemberAvatar
import com.ourhome.today.ui.components.SectionTitle

/** 우리 가족: 구성원, 초대, 그리고 이 앱이 일부러 하지 않는 것 */
@Composable
fun FamilyScreen(state: FamilyState, onSwitchUser: (String) -> Unit) {
    val context = LocalContext.current

    Scaffold(topBar = { TopAppBar(title = { Text("우리 가족") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("가족 초대하기", style = MaterialTheme.typography.titleMedium)
                        Text("초대 코드: ${state.inviteCode}", style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "앱을 자주 열지 않는 가족도 링크로 해당 항목을 열어 보고 응답할 수 있게 만들 예정이에요.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Button(onClick = {
                            // TODO(서버 연동): 실제 초대 링크(딥링크)를 발급해 공유한다.
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "'우리집 오늘'에서 ${state.familyName} 소식을 같이 봐요! 초대 코드: ${state.inviteCode}",
                                )
                            }
                            context.startActivity(Intent.createChooser(send, "가족 초대하기"))
                        }) {
                            Icon(Icons.Filled.Share, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("초대 메시지 보내기")
                        }
                    }
                }
            }

            item {
                Column {
                    SectionTitle("구성원")
                    Text(
                        "프로토타입: 아래에서 다른 가족을 고르면 그 사람 입장에서 앱을 써 볼 수 있어요.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(state.members, key = { it.id }) { m ->
                val selected = m.id == state.currentUserId
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = selected, onClick = { onSwitchUser(m.id) }, role = Role.RadioButton)
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MemberAvatar(m)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(m.name, style = MaterialTheme.typography.titleMedium)
                        Text(m.relation, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    RadioButton(selected = selected, onClick = null)
                }
            }

            item {
                Column {
                    SectionTitle("우리집 오늘이 하지 않는 것")
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(
                                "상시 위치 추적을 하지 않아요.",
                                "접속하지 않거나 응답이 없다고 '안부 경고'를 보내지 않아요.",
                                "사진을 분석해 필요한 물건이나 부모님의 뜻을 추정하지 않아요.",
                                "자녀를 담당자로 자동 지정하지 않아요. 맡는 건 각자 선택이에요.",
                                "가족 소식 사이에 쇼핑 광고를 끼워 넣지 않아요.",
                            ).forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                        }
                    }
                }
            }
        }
    }
}
