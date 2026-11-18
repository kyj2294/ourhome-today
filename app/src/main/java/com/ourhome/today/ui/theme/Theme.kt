package com.ourhome.today.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// 따뜻한 집 느낌의 브랜드 색상. 가족 앱이므로 기기 동적 색상 대신 고정 팔레트를 쓴다.
private val Apricot = Color(0xFFE07A3F)
private val ApricotDark = Color(0xFFFFB68D)
private val Cream = Color(0xFFFFF8F1)
private val Sage = Color(0xFF5E8C6A)
private val Brown = Color(0xFF3D2C22)

private val LightColors = lightColorScheme(
    primary = Apricot,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDCC7),
    onPrimaryContainer = Color(0xFF3A1600),
    secondary = Sage,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD7EBDB),
    onSecondaryContainer = Color(0xFF13321D),
    tertiaryContainer = Color(0xFFFFE8A3),
    onTertiaryContainer = Color(0xFF3B2F00),
    background = Cream,
    onBackground = Brown,
    surface = Cream,
    onSurface = Brown,
    surfaceVariant = Color(0xFFF3E4D8),
    onSurfaceVariant = Color(0xFF52443B),
    surfaceContainerLow = Color(0xFFFFF1E6),
    surfaceContainer = Color(0xFFFAEBDF),
    outlineVariant = Color(0xFFD8C2B5),
)

private val DarkColors = darkColorScheme(
    primary = ApricotDark,
    onPrimary = Color(0xFF552100),
    primaryContainer = Color(0xFF783200),
    onPrimaryContainer = Color(0xFFFFDCC7),
    secondary = Color(0xFFA6D0B0),
    secondaryContainer = Color(0xFF2B4A33),
    onSecondaryContainer = Color(0xFFD7EBDB),
    tertiaryContainer = Color(0xFF574500),
    onTertiaryContainer = Color(0xFFFFE8A3),
    background = Color(0xFF1C1612),
    surface = Color(0xFF1C1612),
)

// 부모님 세대도 편하게 읽을 수 있도록 본문 글자를 조금 크게 잡는다.
private val AppTypography = Typography().let { base ->
    base.copy(
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
        bodyLarge = base.bodyLarge.copy(fontSize = 17.sp, lineHeight = 26.sp),
        bodyMedium = base.bodyMedium.copy(fontSize = 15.sp, lineHeight = 22.sp),
        labelLarge = base.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun OurHomeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
