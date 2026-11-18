@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.request

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.RequestDraft
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.PurchaseSpec
import com.ourhome.today.ui.components.AudiencePicker
import com.ourhome.today.ui.components.SectionTitle
import com.ourhome.today.ui.components.SourcePostPreview
import java.time.LocalDate

/** 희망 시점 빠른 선택. 날짜를 꼭 정하지 않아도 된다. */
enum class DueOption(val label: String, val daysFromToday: Long?) {
    NONE("기한 없음", null),
    TODAY("오늘", 0),
    IN_3_DAYS("3일 안에", 3),
    NEXT_WEEK("다음 주까지", 7),
    ;

    fun toDate(today: LocalDate = LocalDate.now()): LocalDate? = daysFromToday?.let { today.plusDays(it) }
}

/**
 * 부탁 등록. 무엇을 부탁하는지와 공유 대상만 필수다.
 * 원글에서 넘어온 경우 원글의 사진·설명을 그대로 보여주고 다시 올리지 않는다.
 * 구매 부탁일 때만 제품 규격·수량을 덧붙인다.
 */
@Composable
fun RequestFormScreen(
    state: FamilyState,
    sourcePostId: String?,
    onBack: () -> Unit,
    onSubmit: (RequestDraft) -> Unit,
) {
    val source = state.post(sourcePostId)
    var title by rememberSaveable { mutableStateOf("") }
    var detail by rememberSaveable { mutableStateOf("") }
    var due by rememberSaveable { mutableStateOf(DueOption.NONE) }
    var audience by rememberSaveable { mutableStateOf(state.otherMemberIds.toList()) }
    var isPurchase by rememberSaveable { mutableStateOf(false) }
    var spec by rememberSaveable { mutableStateOf("") }
    var quantity by rememberSaveable { mutableStateOf("1") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (source != null) "이 글로 부탁하기" else "가족에게 부탁하기") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
            )
        },
        bottomBar = {
            Box(Modifier.fillMaxWidth().imePadding().padding(16.dp)) {
                Button(
                    onClick = {
                        onSubmit(
                            RequestDraft(
                                sourcePostId = source?.id,
                                title = title,
                                detail = detail,
                                dueDate = due.toDate(),
                                audienceIds = audience.toSet(),
                                purchase = if (isPurchase) PurchaseSpec(spec.trim(), quantity.toIntOrNull() ?: 0) else null,
                            ),
                        )
                    },
                    enabled = title.isNotBlank() && audience.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                ) { Text("부탁하기") }
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
            if (source != null) {
                SourcePostPreview(source, state, onClick = {})
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("무엇을 부탁할까요? (필수)") },
                placeholder = { Text("예: 정수기 필터 주문") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = detail,
                onValueChange = { detail = it },
                label = { Text("자세한 내용 (선택)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )

            SectionTitle("언제까지면 좋을까요?")
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                DueOption.entries.forEach { option ->
                    FilterChip(selected = due == option, onClick = { due = option }, label = { Text(option.label) })
                }
            }

            SectionTitle("누구에게 부탁할까요?")
            AudiencePicker(state, audience.toSet(), onChange = { audience = it.toList() })

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("구매가 필요한 부탁이에요", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "켜면 제품 규격과 수량을 함께 남겨요",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = isPurchase, onCheckedChange = { isPurchase = it })
            }
            if (isPurchase) {
                OutlinedTextField(
                    value = spec,
                    onValueChange = { spec = it },
                    label = { Text("제품 규격 / 모델") },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { v -> quantity = v.filter { it.isDigit() }.take(3) },
                    label = { Text("수량") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Text(
                "부탁을 올려도 담당자는 자동으로 정해지지 않아요. 가족이 직접 '제가 챙길게요'를 눌러 맡아요.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.size(24.dp))
        }
    }
}
