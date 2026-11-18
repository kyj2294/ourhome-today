@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.post

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.ourhome.today.ui.PostIntent
import com.ourhome.today.ui.components.PhotoBox
import com.ourhome.today.ui.components.SectionTitle

private const val MAX_PHOTOS = 5

/**
 * 소식 올리기. 기본은 일상 게시이며, 제목·기한·담당을 요구하지 않는다.
 * 글쓴이가 원할 때만 '일정 제안'이나 '가족에게 부탁'으로 이어간다.
 */
@Composable
fun ComposePostScreen(
    onBack: () -> Unit,
    onSubmit: (text: String, photoUris: List<String>, next: PostIntent) -> Unit,
) {
    var text by rememberSaveable { mutableStateOf("") }
    var intent by rememberSaveable { mutableStateOf(PostIntent.JUST_SHARE) }
    val photos = remember { mutableStateListOf<String>() }

    // Android Photo Picker: 저장소 권한 없이 사진을 고른다.
    // TODO(서버 연동): 고른 사진을 스토리지에 업로드하고 받은 URL을 저장해야 앱을 껐다 켜도 유지된다.
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_PHOTOS),
    ) { uris ->
        uris.map { it.toString() }
            .filter { it !in photos }
            .take(MAX_PHOTOS - photos.size)
            .forEach { photos.add(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("소식 올리기") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로") }
                },
            )
        },
        bottomBar = {
            Box(Modifier.fillMaxWidth().imePadding().padding(16.dp)) {
                Button(
                    onClick = { onSubmit(text, photos.toList(), intent) },
                    enabled = text.isNotBlank() || photos.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                ) {
                    Text(
                        when (intent) {
                            PostIntent.JUST_SHARE -> "올리기"
                            PostIntent.SCHEDULE -> "올리고 일정 제안하기"
                            PostIntent.REQUEST -> "올리고 부탁 만들기"
                        },
                    )
                }
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
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("오늘 있었던 일을 가족과 나눠 보세요") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
            )

            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                photos.forEach { uri ->
                    Box {
                        PhotoBox(uri, Modifier.size(96.dp))
                        FilledTonalIconButton(
                            onClick = { photos.remove(uri) },
                            modifier = Modifier.align(Alignment.TopEnd).size(28.dp),
                        ) { Icon(Icons.Filled.Close, contentDescription = "사진 빼기", Modifier.size(16.dp)) }
                    }
                }
                if (photos.size < MAX_PHOTOS) {
                    OutlinedButton(
                        onClick = {
                            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))
                        },
                        modifier = Modifier.size(96.dp),
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Add, contentDescription = null)
                            Text("사진", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            SectionTitle("이 글로 무엇을 할까요?")
            PostIntent.entries.forEach { option ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = intent == option, onClick = { intent = option }, role = Role.RadioButton)
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = intent == option, onClick = null)
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(option.label, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            option.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Text(
                "소식은 소식으로 끝나도 괜찮아요. 일정이나 부탁은 나중에 글 상세에서도 연결할 수 있어요.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.size(24.dp))
        }
    }
}
