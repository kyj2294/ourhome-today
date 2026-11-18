package com.ourhome.today.ui

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ourhome.today.data.model.NotificationTarget
import com.ourhome.today.ui.family.FamilyScreen
import com.ourhome.today.ui.feed.FeedScreen
import com.ourhome.today.ui.notifications.NotificationsScreen
import com.ourhome.today.ui.post.ComposePostScreen
import com.ourhome.today.ui.post.PostDetailScreen
import com.ourhome.today.ui.request.RequestDetailScreen
import com.ourhome.today.ui.request.RequestFormScreen
import com.ourhome.today.ui.schedule.ScheduleDetailScreen
import com.ourhome.today.ui.schedule.ScheduleFormScreen
import com.ourhome.today.ui.together.TogetherScreen

/** 화면 경로 */
object Routes {
    const val FEED = "feed"
    const val TOGETHER = "together"
    const val FAMILY = "family"
    const val COMPOSE = "compose"
    const val NOTIFICATIONS = "notifications"

    const val POST = "post/{postId}"
    fun post(id: String) = "post/$id"

    const val REQUEST = "request/{requestId}"
    fun request(id: String) = "request/$id"

    const val SCHEDULE = "schedule/{scheduleId}"
    fun schedule(id: String) = "schedule/$id"

    /** 부탁 등록. postId가 있으면 원글의 사진·설명을 불러와 연결한다. */
    const val NEW_REQUEST = "new-request?postId={postId}"
    fun newRequest(postId: String? = null) = if (postId == null) "new-request" else "new-request?postId=$postId"

    const val NEW_SCHEDULE = "new-schedule?postId={postId}"
    fun newSchedule(postId: String? = null) = if (postId == null) "new-schedule" else "new-schedule?postId=$postId"
}

private data class TopLevelTab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    TopLevelTab(Routes.FEED, "가족 소식", Icons.Filled.Home),
    TopLevelTab(Routes.TOGETHER, "함께할 일", Icons.Filled.DateRange),
    TopLevelTab(Routes.FAMILY, "우리 가족", Icons.Filled.Person),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OurHomeApp(vm: AppViewModel = viewModel()) {
    val navController = rememberNavController()
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        vm.messages.collect { snackbar.showSnackbar(it) }
    }

    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = tabs.any { it.route == currentRoute }

    Scaffold(
        // 각 화면이 자체 TopAppBar로 상단 인셋을 처리하므로 바깥 Scaffold는 인셋을 적용하지 않는다.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = { navController.navigateToTab(tab.route) },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        val nav = navController
        NavHost(
            navController = nav,
            startDestination = Routes.FEED,
            modifier = Modifier.padding(innerPadding).consumeWindowInsets(innerPadding),
        ) {
            composable(Routes.FEED) {
                FeedScreen(
                    state = state,
                    onOpenPost = { nav.navigate(Routes.post(it)) },
                    onOpenRequest = { nav.navigate(Routes.request(it)) },
                    onOpenSchedule = { nav.navigate(Routes.schedule(it)) },
                    onCompose = { nav.navigate(Routes.COMPOSE) },
                    onOpenNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
                )
            }
            composable(Routes.TOGETHER) {
                TogetherScreen(
                    state = state,
                    onOpenRequest = { nav.navigate(Routes.request(it)) },
                    onOpenSchedule = { nav.navigate(Routes.schedule(it)) },
                    onNewRequest = { nav.navigate(Routes.newRequest()) },
                    onNewSchedule = { nav.navigate(Routes.newSchedule()) },
                    onOpenNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
                )
            }
            composable(Routes.FAMILY) {
                FamilyScreen(state = state, onSwitchUser = vm::switchUser)
            }
            composable(Routes.NOTIFICATIONS) {
                NotificationsScreen(
                    state = state,
                    onMarkAllRead = vm::markMyNotificationsRead,
                    onBack = { nav.popBackStack() },
                    onOpen = { target ->
                        when (target) {
                            is NotificationTarget.PostTarget -> nav.navigate(Routes.post(target.postId))
                            is NotificationTarget.RequestTarget -> nav.navigate(Routes.request(target.requestId))
                            is NotificationTarget.ScheduleTarget -> nav.navigate(Routes.schedule(target.scheduleId))
                        }
                    },
                )
            }
            composable(Routes.COMPOSE) {
                ComposePostScreen(
                    onBack = { nav.popBackStack() },
                    onSubmit = { text, photos, next ->
                        val postId = vm.createPost(text, photos)
                        if (postId != null) {
                            nav.popBackStack()
                            when (next) {
                                PostIntent.JUST_SHARE -> Unit
                                PostIntent.SCHEDULE -> nav.navigate(Routes.newSchedule(postId))
                                PostIntent.REQUEST -> nav.navigate(Routes.newRequest(postId))
                            }
                        }
                    },
                )
            }
            composable(
                Routes.POST,
                arguments = listOf(navArgument("postId") { type = NavType.StringType }),
            ) { entry ->
                val postId = entry.arguments?.getString("postId").orEmpty()
                PostDetailScreen(
                    state = state,
                    postId = postId,
                    onBack = { nav.popBackStack() },
                    onMarkRead = { vm.markPostRead(postId) },
                    onAddComment = { vm.addComment(postId, it) },
                    onLinkRequest = { nav.navigate(Routes.newRequest(postId)) },
                    onLinkSchedule = { nav.navigate(Routes.newSchedule(postId)) },
                    onOpenRequest = { nav.navigate(Routes.request(it)) },
                    onOpenSchedule = { nav.navigate(Routes.schedule(it)) },
                )
            }
            composable(
                Routes.REQUEST,
                arguments = listOf(navArgument("requestId") { type = NavType.StringType }),
            ) { entry ->
                val requestId = entry.arguments?.getString("requestId").orEmpty()
                RequestDetailScreen(
                    state = state,
                    requestId = requestId,
                    vm = vm,
                    onBack = { nav.popBackStack() },
                    onOpenPost = { nav.navigate(Routes.post(it)) },
                )
            }
            composable(
                Routes.SCHEDULE,
                arguments = listOf(navArgument("scheduleId") { type = NavType.StringType }),
            ) { entry ->
                val scheduleId = entry.arguments?.getString("scheduleId").orEmpty()
                ScheduleDetailScreen(
                    state = state,
                    scheduleId = scheduleId,
                    vm = vm,
                    onBack = { nav.popBackStack() },
                    onOpenPost = { nav.navigate(Routes.post(it)) },
                )
            }
            composable(
                Routes.NEW_REQUEST,
                arguments = listOf(optionalPostIdArg()),
            ) { entry ->
                RequestFormScreen(
                    state = state,
                    sourcePostId = entry.arguments?.getString("postId"),
                    onBack = { nav.popBackStack() },
                    onSubmit = { draft ->
                        vm.createRequest(draft)?.let { id ->
                            nav.popBackStack()
                            nav.navigate(Routes.request(id))
                        }
                    },
                )
            }
            composable(
                Routes.NEW_SCHEDULE,
                arguments = listOf(optionalPostIdArg()),
            ) { entry ->
                ScheduleFormScreen(
                    state = state,
                    sourcePostId = entry.arguments?.getString("postId"),
                    onBack = { nav.popBackStack() },
                    onSubmit = { draft ->
                        vm.createSchedule(draft)?.let { id ->
                            nav.popBackStack()
                            nav.navigate(Routes.schedule(id))
                        }
                    },
                )
            }
        }
    }
}

/** 게시 후 이어서 할 일 — 기본은 그냥 소식 공유 */
enum class PostIntent(val label: String, val description: String) {
    JUST_SHARE("그냥 소식", "가족 소식으로만 올려요"),
    SCHEDULE("일정 제안", "이 글로 가족 일정을 제안해요"),
    REQUEST("가족에게 부탁", "이 글의 사진·설명으로 부탁을 만들어요"),
}

private fun optionalPostIdArg() = navArgument("postId") {
    type = NavType.StringType
    nullable = true
    defaultValue = null
}

private fun NavHostController.navigateToTab(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
