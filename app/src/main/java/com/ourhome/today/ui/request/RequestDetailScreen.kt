@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.request

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ourhome.today.data.model.FamilyRequest
import com.ourhome.today.data.model.FamilyState
import com.ourhome.today.data.model.PurchaseSpec
import com.ourhome.today.data.model.RequestStatus
import com.ourhome.today.ui.AppViewModel
import com.ourhome.today.ui.components.Formatters
import com.ourhome.today.ui.components.MemberAvatar
import com.ourhome.today.ui.components.RequestStatusBadge
import com.ourhome.today.ui.components.SectionTitle
import com.ourhome.today.ui.components.SourcePostPreview

/**
 * 부탁 상세.
 * 아직 맡은 사람 없음 → 제가 챙길게요 → 진행(주문했어요) → 완료(받았어요) / 취소
 * 지금 사용자가 요청자인지, 담당자인지, 그 외 가족인지에 따라 누를 수 있는 버튼이 달라진다.
 */
@Composable
fun RequestDetailScreen(
    state: FamilyState,
    requestId: String,
    vm: AppViewModel,
    onBack: () -> Unit,
    onOpenPost: (String) -> Unit,
) {
    val request = state.request(requestId)
    LaunchedEffect(requestId, state.currentUserId) { vm.markRequestSeen(requestId) }
    var showRelease by rememberSaveable { mutableStateOf(false) }
    var showEdit by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (request?.isPurchase == true) "구매 부탁" else "부탁") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
                actions = {
                    if (request != null && request.requesterId == state.currentUserId && request.isActive) {
                        IconButton(onClick = { showEdit = true }) { Icon(Icons.Filled.Edit, contentDescription = "내용 바꾸기") }
                    }
                },
            )
        },
    ) { padding ->
        if (request == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("부탁을 찾을 수 없어요") }
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(request.title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                    RequestStatusBadge(request)
                }
            }
            item { RequestFacts(request, state) }
            request.sourcePostId?.let { state.post(it) }?.let { post ->
                item { SourcePostPreview(post, state, onClick = { onOpenPost(post.id) }) }
            }
            item { RequestActions(request, state, vm, onRelease = { showRelease = true }) }
            if (request.isPurchase && request.isActive) {
                item { AffiliatePlaceholder() }
            }
            item { SectionTitle("처리 기록") }
            items(request.history.reversed()) { h ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MemberAvatar(state.member(h.actorId), size = 28.dp)
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text("${state.nameOf(h.actorId)} · ${h.message}", style = MaterialTheme.typography.bodyMedium)
                        Text(Formatters.relative(h.at), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }

    if (showRelease && request != null) {
        ReleaseDialog(
            onDismiss = { showRelease = false },
            onConfirm = { reason ->
                vm.releaseRequest(request.id, reason)
                showRelease = false
            },
        )
    }
    if (showEdit && request != null) {
        EditRequestDialog(
            request = request,
            onDismiss = { showEdit = false },
            onSave = { detail, due, purchase ->
                if (vm.updateRequest(request.id, detail, due, purchase) != null) showEdit = false
            },
        )
    }
}

@Composable
private fun RequestFacts(request: FamilyRequest, state: FamilyState) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Fact("부탁한 사람", state.nameOf(request.requesterId))
            Fact("희망 시점", Formatters.due(request.dueDate))
            Fact("담당", request.assigneeId?.let { state.nameOf(it) } ?: "아직 맡은 사람 없음")
            Fact("공유 대상", request.audienceIds.joinToString { state.nameOf(it) })
            request.purchase?.let {
                Fact("제품 규격", it.spec.ifBlank { "-" })
                Fact("수량", "${it.quantity}개")
            }
            if (request.detail.isNotBlank()) Fact("내용", request.detail)
            // 확인(읽음)은 수락·주문·수령을 대신하지 않는다.
            Fact("확인한 가족", request.seenBy.joinToString { state.nameOf(it) })
        }
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Row {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(96.dp),
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun RequestActions(
    request: FamilyRequest,
    state: FamilyState,
    vm: AppViewModel,
    onRelease: () -> Unit,
) {
    val me = state.currentUserId
    val isRequester = request.requesterId == me
    val isAssignee = request.assigneeId == me
    val big = Modifier.fillMaxWidth().heightIn(min = 52.dp)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (request.status) {
            RequestStatus.OPEN -> {
                if (!isRequester && me in request.audienceIds) {
                    Button(onClick = { vm.claimRequest(request.id) }, modifier = big) { Text("제가 챙길게요") }
                } else if (isRequester) {
                    Hint("아직 맡은 사람이 없어요. 가족이 직접 맡으면 알려 드릴게요.")
                }
            }
            RequestStatus.CLAIMED -> {
                if (isAssignee) {
                    Button(onClick = { vm.markInProgress(request.id) }, modifier = big) {
                        Text(if (request.isPurchase) "주문했어요" else "진행 중이에요")
                    }
                    if (!request.isPurchase) {
                        OutlinedButton(onClick = { vm.markDone(request.id) }, modifier = big) { Text("완료했어요") }
                    }
                } else {
                    Hint("${state.nameOf(request.assigneeId)}님이 맡았어요.")
                }
            }
            RequestStatus.IN_PROGRESS -> {
                if (request.isPurchase) {
                    if (isRequester) {
                        Button(onClick = { vm.markDone(request.id) }, modifier = big) { Text("받았어요") }
                    } else {
                        Hint("주문 완료. 물건을 받으면 ${state.nameOf(request.requesterId)}님이 '받았어요'로 마무리해요.")
                    }
                } else if (isAssignee || isRequester) {
                    Button(onClick = { vm.markDone(request.id) }, modifier = big) { Text("완료했어요") }
                } else {
                    Hint("${state.nameOf(request.assigneeId)}님이 진행 중이에요.")
                }
            }
            RequestStatus.DONE -> Hint("마무리된 부탁이에요. 고마워요!")
            RequestStatus.CANCELED -> Hint("취소된 부탁이에요.")
        }

        if (isAssignee && (request.status == RequestStatus.CLAIMED || request.status == RequestStatus.IN_PROGRESS)) {
            TextButton(onClick = onRelease) { Text("더는 처리하기 어려워요 (맡기 취소)") }
        }
        if (isRequester && request.isActive) {
            TextButton(onClick = { vm.cancelRequest(request.id) }) { Text("부탁 취소하기") }
        }
    }
}

@Composable
private fun Hint(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

/** 제휴 판매처 연결은 초기 이후 단계에서 붙인다 (기획서: 우선순위). */
@Composable
private fun AffiliatePlaceholder() {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("판매처 찾아보기 · 준비 중", style = MaterialTheme.typography.titleMedium)
            Text(
                "다음 단계에서 규격에 맞는 판매처 링크(제휴 표시)를 고를 수 있게 할 예정이에요. " +
                    "지금은 평소 쓰는 쇼핑몰에서 주문하고 '주문했어요'만 눌러 주세요.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ReleaseDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var reason by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("맡기 취소") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("부탁한 가족에게 알리고, 다시 '담당 없음'으로 돌아가요.")
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("짧은 사유 (선택)") },
                    singleLine = true,
                )
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(reason) }) { Text("맡기 취소") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("닫기") } },
    )
}

@Composable
private fun EditRequestDialog(
    request: FamilyRequest,
    onDismiss: () -> Unit,
    onSave: (String, java.time.LocalDate?, PurchaseSpec?) -> Unit,
) {
    var detail by rememberSaveable { mutableStateOf(request.detail) }
    var due by rememberSaveable { mutableStateOf<DueOption?>(null) } // null = 기존 기한 유지
    var spec by rememberSaveable { mutableStateOf(request.purchase?.spec.orEmpty()) }
    var quantity by rememberSaveable { mutableStateOf(request.purchase?.quantity?.toString() ?: "1") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("부탁 내용 바꾸기") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "전화로 바뀐 내용도 여기서 고쳐 주세요. 담당자에게 알림이 가요.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedTextField(value = detail, onValueChange = { detail = it }, label = { Text("내용") })
                Text("희망 시점: " + (due?.label ?: Formatters.due(request.dueDate)), style = MaterialTheme.typography.labelLarge)
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    DueOption.entries.forEach { o ->
                        FilterChip(selected = due == o, onClick = { due = o }, label = { Text(o.label, maxLines = 1) })
                    }
                }
                if (request.isPurchase) {
                    OutlinedTextField(value = spec, onValueChange = { spec = it }, label = { Text("제품 규격") })
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { v -> quantity = v.filter { it.isDigit() }.take(3) },
                        label = { Text("수량") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                    )
                }
                Spacer(Modifier.size(4.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    detail,
                    due?.toDate() ?: if (due == null) request.dueDate else null,
                    if (request.isPurchase) PurchaseSpec(spec.trim(), quantity.toIntOrNull() ?: 0) else null,
                )
            }) { Text("저장") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("닫기") } },
    )
}
