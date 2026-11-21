import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider } from './store/store'
import { Icon, type IconName } from './ui/components/icons'
import { ComposePage } from './ui/pages/ComposePage'
import { FamilyPage } from './ui/pages/FamilyPage'
import { FeedPage } from './ui/pages/FeedPage'
import { NotificationsPage } from './ui/pages/NotificationsPage'
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

export default function App() {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number>()
  const showToast = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  return (
    <BrowserRouter>
      <StoreProvider onToast={showToast}>
        <div className="app">
          <ScrollToTop />
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
            <Route path="*" element={<FeedPage />} />
          </Routes>
          <BottomNav />
        </div>
      </StoreProvider>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </BrowserRouter>
  )
}
