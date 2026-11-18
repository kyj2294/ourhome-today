@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.schedule

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.ScheduleDraft
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.ui.components.AudiencePicker
import com.ourhome.today.ui.components.SectionTitle
import com.ourhome.today.ui.components.SourcePostPreview
import java.time.LocalDate
import java.time.LocalDateTime

/** 일정 제안. 날짜만 공유하는 데서 끝내지 않고 가족에게 가능/조정/어려움 응답을 요청한다. */
@Composable
fun ScheduleFormScreen(
    state: FamilyState,
    sourcePostId: String?,
    onBack: () -> Unit,
    onSubmit: (ScheduleDraft) -> Unit,
) {
    val source = state.post(sourcePostId)
    var title by rememberSaveable { mutableStateOf("") }
    var place by rememberSaveable { mutableStateOf("") }
    var startAt by rememberSaveable { mutableStateOf<LocalDateTime>(LocalDate.now().plusDays(1).atTime(12, 0)) }
    var audience by rememberSaveable { mutableStateOf(state.otherMemberIds.toList()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (source != null) "이 글로 일정 제안" else "일정 제안하기") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
            )
        },
        bottomBar = {
            Box(Modifier.fillMaxWidth().imePadding().padding(16.dp)) {
                Button(
                    onClick = {
                        onSubmit(ScheduleDraft(source?.id, title, startAt, place, audience.toSet()))
                    },
                    enabled = title.isNotBlank() && audience.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                ) { Text("제안하기") }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (source != null) SourcePostPreview(source, state, onClick = {})

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("어떤 일정인가요? (필수)") },
                placeholder = { Text("예: 주말 김장하기") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            SectionTitle("언제")
            DateTimeField(startAt, onChange = { startAt = it })
            OutlinedTextField(
                value = place,
                onValueChange = { place = it },
                label = { Text("어디서 (선택)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            SectionTitle("누구에게 응답을 받을까요?")
            AudiencePicker(state, audience.toSet(), onChange = { audience = it.toList() })
            Text(
                "가족은 '가능해요 · 시간 바꿔요 · 이번엔 어려워요'로 답해요. 확인했다고 참석자로 넣지 않아요.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.size(24.dp))
        }
    }
}
