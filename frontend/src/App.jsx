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
  { id: 'home', icon: 'HM', label: 'Home', view: 'home', focus: '' },
  { id: 'dashboard', icon: 'DB', label: 'Dashboard', view: 'dashboard', focus: '' },
  { id: 'calls', icon: 'CL', label: 'My Calls', view: 'dashboard', focus: 'calls' },
  { id: 'transcripts', icon: 'TR', label: 'Transcripts', view: 'dashboard', focus: 'transcripts' },
  { id: 'coach', icon: 'AI', label: 'AI Coach', view: 'dashboard', focus: 'coach' },
  { id: 'performance', icon: 'PF', label: 'Performance', view: 'dashboard', focus: 'performance' },
  { id: 'training', icon: 'TN', label: 'Training', view: 'dashboard', focus: 'training' },
  { id: 'reports', icon: 'RP', label: 'Reports', view: 'dashboard', focus: 'reports' },
  { id: 'leaderboard', icon: 'LB', label: 'Leaderboard', view: 'leaderboard', focus: '' },
  { id: 'upload', icon: 'UP', label: 'Upload Call', view: 'upload', focus: '' },
  { id: 'profile', icon: 'PR', label: 'Profile', view: 'profile', focus: '' },
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

  function openCall(callId) {
    setSelectedCallId(callId)
    setActiveView('details')
    setIsSidebarOpen(false)
  }

  function handleCallAnalyzed(callId) {
    setRefreshKey((current) => current + 1)
    if (callId) {
      setSelectedCallId(callId)
    }
  }

  function goHome() {
    setActiveView('home')
    setDashboardFocus('')
    setIsSidebarOpen(false)
  }

  function openUpload() {
    setActiveView('upload')
    setDashboardFocus('')
    setIsSidebarOpen(false)
  }

  function openPage(view, focus = '') {
    setActiveView(view)
    setDashboardFocus(focus)
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
        <span />
        <span />
        <span />
      </button>

      <aside className={sidebarClassName} aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <p className="eyebrow">Call Center AI</p>
          <strong>Welcome {firstName}</strong>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
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
            <button className="secondary-button" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {activeView !== 'home' ? <HomeReturnBar pageTitle={pageTitle} onGoHome={goHome} /> : null}

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
          <CallDetails callId={selectedCallId} onBack={goHome} />
        ) : null}

        {activeView === 'profile' ? (
          <ProfileView currentUser={currentUser} onStartUpload={openUpload} />
        ) : null}
      </section>
    </main>
  )
}

function HomeReturnBar({ pageTitle, onGoHome }) {
  return (
    <div className="home-return-bar">
      <span>{pageTitle}</span>
      <button className="secondary-button" type="button" onClick={onGoHome}>
        Back to Home
      </button>
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
