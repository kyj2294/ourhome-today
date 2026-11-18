package com.ourhome.today

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.ourhome.today.ui.OurHomeApp
import com.ourhome.today.ui.theme.OurHomeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            OurHomeTheme {
                OurHomeApp()
            }
        }
    }
}
