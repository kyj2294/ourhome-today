import { useCallback, useEffect, useRef, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { memberOf } from './domain/models'
import { StoreProvider, useStore } from './store/store'
import { CallProvider } from './ui/components/call'
import { Icon, type IconName } from './ui/components/icons'
import { ParentCompose, ParentHome, ParentPost, ParentRequest } from './ui/parent/ParentPages'
import { CallNotePage } from './ui/pages/CallNotePage'
import { ComposePage } from './ui/pages/ComposePage'
import { FamilyPage } from './ui/pages/FamilyPage'
import { FeedPage } from './ui/pages/FeedPage'
import { NotificationsPage } from './ui/pages/NotificationsPage'
import { OnboardingPage } from './ui/pages/OnboardingPage'
import { PostDetailPage } from './ui/pages/PostDetailPage'
import { RequestDetailPage, RequestFormPage } from './ui/pages/RequestPages'
import { ScheduleDetailPage, ScheduleFormPage } from './ui/pages/SchedulePages'
import { TogetherPage } from './ui/pages/TogetherPage'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '가족 소식', icon: 'home' },
  { to: '/together', label: '함께할 일', icon: 'together' },
  { to: '/family', label: '우리 가족', icon: 'family' },
]

function BottomNav() {
  const { pathname } = useLocation()
  if (!TABS.some((t) => t.to === pathname)) return null
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** 자녀 화면: 전체 기능 */
function ChildApp() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/together" element={<TogetherPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route path="/request/new" element={<RequestFormPage />} />
        <Route path="/request/:id" element={<RequestDetailPage />} />
        <Route path="/schedule/new" element={<ScheduleFormPage />} />
        <Route path="/schedule/:id" element={<ScheduleDetailPage />} />
        <Route path="/call/:id" element={<CallNotePage />} />
        <Route path="*" element={<FeedPage />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

/** 부모님 화면: 큰 글씨, 한 화면에서 끝 */
function ParentApp() {
  return (
    <div className="app parent">
      <Routes>
        <Route path="/" element={<ParentHome />} />
        <Route path="/compose" element={<ParentCompose />} />
        <Route path="/request/new" element={<ParentRequest />} />
        <Route path="/post/:id" element={<ParentPost />} />
        <Route path="/call/:id" element={<CallNotePage />} />
        {/* 알림 링크 등으로 들어온 상세 화면은 자녀 화면 것을 큰 글씨로 보여준다 */}
        <Route path="/request/:id" element={<RequestDetailPage />} />
        <Route path="/schedule/:id" element={<ScheduleDetailPage />} />
        <Route path="*" element={<ParentHome />} />
      </Routes>
    </div>
  )
}

function Shell() {
  const { state, signedIn } = useStore()
  if (!signedIn) {
    return (
      <div className="app">
        <OnboardingPage />
      </div>
    )
  }
  const role = memberOf(state, state.currentUserId)?.role ?? 'child'
  return <CallProvider>{role === 'parent' ? <ParentApp /> : <ChildApp />}</CallProvider>
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number>()
  const showToast = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  return (
    <HashRouter>
      <ScrollToTop />
      <StoreProvider onToast={showToast}>
        <Shell />
      </StoreProvider>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </HashRouter>
  )
}
