import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Dashboard, { LeaderboardView } from './pages/Dashboard.jsx'
import CallDetails from './pages/CallDetails.jsx'
import CallTranscription from './pages/CallTranscription.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import './App.css'

const navigationItems = [
  { id: 'home', icon: '⌂', label: 'Home', view: 'home', focus: '' },
  { id: 'dashboard', icon: '▦', label: 'Dashboard', view: 'dashboard', focus: '' },
  { id: 'calls', icon: '☎', label: 'My Calls', view: 'dashboard', focus: 'calls' },
  { id: 'transcripts', icon: '▤', label: 'Transcripts', view: 'dashboard', focus: 'transcripts' },
  { id: 'coach', icon: '✦', label: 'AI Coach', view: 'dashboard', focus: 'coach' },
  { id: 'performance', icon: '↗', label: 'Performance', view: 'dashboard', focus: 'performance' },
  { id: 'training', icon: '◫', label: 'Training', view: 'dashboard', focus: 'training' },
  { id: 'reports', icon: '◧', label: 'Reports', view: 'dashboard', focus: 'reports' },
  { id: 'leaderboard', icon: '★', label: 'Leaderboard', view: 'leaderboard', focus: '' },
  { id: 'upload', icon: '↑', label: 'Upload Call', view: 'upload', focus: '' },
  { id: 'profile', icon: '●', label: 'Profile', view: 'profile', focus: '' },
]

const menuGroups = [
  {
    title: 'Workspace',
    items: navigationItems.filter((item) => ['home', 'dashboard', 'leaderboard', 'upload'].includes(item.id)),
  },
  {
    title: 'Analysis',
    items: navigationItems.filter((item) => ['calls', 'transcripts', 'coach', 'performance'].includes(item.id)),
  },
  {
    title: 'Growth',
    items: navigationItems.filter((item) => ['training', 'reports', 'profile'].includes(item.id)),
  },
]

function AuthScreen() {
  const { currentUser, logout } = useAuth()

  if (currentUser) {
    return <Workspace currentUser={currentUser} onLogout={logout} />
  }

  return <AuthSwitcher />
}

function Workspace({ currentUser, onLogout }) {
  const [activeView, setActiveView] = useState('home')
  const [selectedCallId, setSelectedCallId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [dashboardFocus, setDashboardFocus] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [previousPage, setPreviousPage] = useState(null)

  function currentPage() {
    return {
      view: activeView,
      focus: dashboardFocus,
      callId: selectedCallId,
    }
  }

  function navigateTo(view, focus = '', callId = selectedCallId, rememberPrevious = true) {
    if (rememberPrevious && (view !== activeView || focus !== dashboardFocus || callId !== selectedCallId)) {
      setPreviousPage(currentPage())
    }

    setActiveView(view)
    setDashboardFocus(focus)
    setSelectedCallId(callId || '')
    setIsSidebarOpen(false)
  }

  function openCall(callId) {
    navigateTo('details', '', callId)
  }

  function handleCallAnalyzed(callId) {
    setRefreshKey((current) => current + 1)
    if (callId) {
      setSelectedCallId(callId)
    }
  }

  function goHome() {
    navigateTo('home')
  }

  function openUpload() {
    navigateTo('upload')
  }

  function openPage(view, focus = '') {
    navigateTo(view, focus)
  }

  function goBack() {
    if (!previousPage) {
      goHome()
      return
    }

    setActiveView(previousPage.view)
    setDashboardFocus(previousPage.focus || '')
    setSelectedCallId(previousPage.callId || '')
    setPreviousPage(null)
    setIsSidebarOpen(false)
  }

  function openNavigation(item) {
    openPage(item.view, item.focus || '')
  }

  const activeNavigationId =
    activeView === 'dashboard'
      ? navigationItems.find((item) => item.view === 'dashboard' && item.focus === dashboardFocus)?.id || 'dashboard'
      : navigationItems.find((item) => item.view === activeView)?.id

  const pageTitle =
    activeView === 'home'
      ? 'Home'
      : activeView === 'leaderboard'
      ? 'Leaderboard'
      : activeView === 'upload'
        ? 'Upload Call'
        : activeView === 'details'
          ? 'Call Details'
          : activeView === 'profile'
            ? 'Profile'
            : dashboardFocus === 'transcripts'
              ? 'Transcripts'
              : dashboardFocus === 'coach'
              ? 'AI Coach'
              : dashboardFocus === 'reports'
                ? 'Reports'
                : dashboardFocus === 'calls'
                  ? 'My Calls'
                  : dashboardFocus === 'performance'
                    ? 'Performance'
                    : dashboardFocus === 'training'
                      ? 'Training'
                      : currentUser.role === 'Manager'
                        ? 'Manager Dashboard'
                        : 'Employee Dashboard'

  const sidebarClassName = isSidebarOpen ? 'workspace-sidebar open' : 'workspace-sidebar'
  const firstName = currentUser.fullName?.split(' ')[0] || currentUser.fullName || 'there'

  return (
    <main className="workspace-shell">
      <button
        className="sidebar-toggle"
        type="button"
        aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <aside className={sidebarClassName} aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">AI</div>
          <div>
            <p className="eyebrow">Call Center AI</p>
            <strong>Welcome {firstName}</strong>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group) => (
            <div className="sidebar-menu-group" key={group.title}>
              <span>{group.title}</span>
              {group.items.map((item) => (
                <button
                  className={activeNavigationId === item.id ? 'sidebar-link active' : 'sidebar-link'}
                  type="button"
                  key={item.id}
                  onClick={() => openNavigation(item)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-profile">
          <span>{currentUser.role}</span>
          <strong>{currentUser.employeeId}</strong>
          <button className="secondary-button" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      {isSidebarOpen ? (
        <button
          className="workspace-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <section className="workspace-content">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">AI Call Center Evaluation</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="user-panel" aria-label="Current user">
            <span>{currentUser.fullName}</span>
            <strong>{currentUser.employeeId}</strong>
          </div>
        </header>

        {activeView !== 'home' ? <HomeReturnBar pageTitle={pageTitle} onBack={goBack} onGoHome={goHome} /> : null}

        {activeView === 'home' ? (
          <Home
            currentUser={currentUser}
            onNavigate={openPage}
            onOpenCall={openCall}
            onStartUpload={openUpload}
            refreshKey={refreshKey}
          />
        ) : null}

        {activeView === 'dashboard' ? (
          <Dashboard
            currentUser={currentUser}
            onOpenCall={openCall}
            onStartUpload={openUpload}
            focusSection={dashboardFocus}
            refreshKey={refreshKey}
          />
        ) : null}

        {activeView === 'leaderboard' ? (
          <LeaderboardView currentUser={currentUser} refreshKey={refreshKey} />
        ) : null}

        {activeView === 'upload' ? (
          <CallTranscription
            currentUser={currentUser}
            onCallAnalyzed={handleCallAnalyzed}
            onOpenCall={openCall}
          />
        ) : null}

        {activeView === 'details' ? (
          <CallDetails callId={selectedCallId} onBack={goBack} />
        ) : null}

        {activeView === 'profile' ? (
          <ProfileView currentUser={currentUser} onStartUpload={openUpload} />
        ) : null}
      </section>
    </main>
  )
}

function HomeReturnBar({ pageTitle, onBack, onGoHome }) {
  return (
    <div className="home-return-bar">
      <span>{pageTitle}</span>
      <div className="return-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          Back
        </button>
        <button className="secondary-button" type="button" onClick={onGoHome}>
          Home
        </button>
      </div>
    </div>
  )
}

function ProfileView({ currentUser, onStartUpload }) {
  return (
    <section className="profile-layout" aria-label="Profile">
      <article className="dashboard-panel profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {currentUser.fullName?.slice(0, 1).toUpperCase() || 'U'}
        </div>
        <div>
          <p className="eyebrow">Profile</p>
          <h2>{currentUser.fullName}</h2>
          <p className="detail-subtitle">{currentUser.role}</p>
        </div>
        <div className="summary-grid">
          <ProfileItem label="Employee ID" value={currentUser.employeeId} />
          <ProfileItem label="Email" value={currentUser.email} />
          <ProfileItem label="Role" value={currentUser.role} />
          <ProfileItem label="Workspace" value="Call Center Evaluation" />
        </div>
        <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
          Upload New Call
        </button>
      </article>
    </section>
  )
}

function ProfileItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  )
}

function AuthSwitcher() {
  const initialMode =
    new URLSearchParams(window.location.search).get('mode') === 'register'
      ? 'register'
      : 'login'
  const [mode, setMode] = useState(initialMode)

  return (
    <main className="auth-shell">
      {mode === 'login' ? (
        <Login onShowRegister={() => setMode('register')} />
      ) : (
        <Register onShowLogin={() => setMode('login')} />
      )}
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthScreen />
    </AuthProvider>
  )
}

export default App
