@file:OptIn(ExperimentalMaterial3Api::class)

package com.ourhome.today.ui.schedule

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ourhome.today.ui.components.Formatters
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val timeFormat = DateTimeFormatter.ofPattern("a h:mm", Locale.KOREAN)

/** 날짜 버튼 + 시간 버튼. 누르면 Material 날짜/시간 선택 창이 열린다. */
@Composable
fun DateTimeField(value: LocalDateTime, onChange: (LocalDateTime) -> Unit) {
    var showDate by rememberSaveable { mutableStateOf(false) }
    var showTime by rememberSaveable { mutableStateOf(false) }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { showDate = true }) {
            Icon(Icons.Filled.DateRange, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text(Formatters.date(value.toLocalDate()))
        }
        OutlinedButton(onClick = { showTime = true }) { Text(value.format(timeFormat)) }
    }

    if (showDate) {
        // DatePicker는 UTC 자정 기준 millis를 쓴다.
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = value.toLocalDate().atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { ms ->
                        val date: LocalDate = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                        onChange(value.with(date))
                    }
                    showDate = false
                }) { Text("확인") }
            },
            dismissButton = { TextButton(onClick = { showDate = false }) { Text("취소") } },
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showTime) {
        val timeState = rememberTimePickerState(initialHour = value.hour, initialMinute = value.minute, is24Hour = false)
        AlertDialog(
            onDismissRequest = { showTime = false },
            title = { Text("시간 고르기") },
            text = { TimePicker(state = timeState) },
            confirmButton = {
                TextButton(onClick = {
                    onChange(value.withHour(timeState.hour).withMinute(timeState.minute))
                    showTime = false
                }) { Text("확인") }
            },
            dismissButton = { TextButton(onClick = { showTime = false }) { Text("취소") } },
        )
    }
}
