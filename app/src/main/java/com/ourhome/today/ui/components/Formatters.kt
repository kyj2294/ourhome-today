package com.ourhome.today.ui.components

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/** 날짜·시간을 가족이 읽기 편한 한국어로 바꾼다. */
object Formatters {
    private val monthDay = DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN)
    private val monthDayTime = DateTimeFormatter.ofPattern("M월 d일 (E) a h:mm", Locale.KOREAN)

    fun relative(at: LocalDateTime, now: LocalDateTime = LocalDateTime.now()): String {
        val d = Duration.between(at, now)
        return when {
            d.toMinutes() < 1 -> "방금"
            d.toMinutes() < 60 -> "${d.toMinutes()}분 전"
            d.toHours() < 24 -> "${d.toHours()}시간 전"
            ChronoUnit.DAYS.between(at.toLocalDate(), now.toLocalDate()) == 1L -> "어제"
            else -> at.format(monthDay)
        }
    }

    fun due(date: LocalDate?, today: LocalDate = LocalDate.now()): String = when {
        date == null -> "기한 없음"
        date.isBefore(today) -> "${date.format(monthDay)}까지 (지남)"
        date == today -> "오늘까지"
        date == today.plusDays(1) -> "내일까지"
        else -> "${date.format(monthDay)}까지"
    }

    fun dateTime(at: LocalDateTime): String = at.format(monthDayTime)
    fun date(d: LocalDate): String = d.format(monthDay)
}
