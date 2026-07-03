import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api.js'

const quickLinks = [
  {
    title: 'My Calls',
    label: 'CL',
    detail: 'Review call history and open full evaluations.',
    view: 'dashboard',
    focus: 'calls',
    tone: 'blue',
  },
  {
    title: 'AI Coach',
    label: 'AI',
    detail: 'Ask for guidance based on your latest calls.',
    view: 'dashboard',
    focus: 'coach',
    tone: 'purple',
  },
  {
    title: 'Performance',
    label: 'PF',
    detail: 'Track score movement and skill health.',
    view: 'dashboard',
    focus: 'performance',
    tone: 'green',
  },
  {
    title: 'Training',
    label: 'TR',
    detail: 'Practice recommended skills and next steps.',
    view: 'dashboard',
    focus: 'training',
    tone: 'amber',
  },
  {
    title: 'Reports',
    label: 'RP',
    detail: 'Export call summaries and performance data.',
    view: 'dashboard',
    focus: 'reports',
    tone: 'blue',
  },
  {
    title: 'Leaderboard',
    label: 'LB',
    detail: 'Compare ranking with your team.',
    view: 'leaderboard',
    focus: '',
    tone: 'purple',
  },
]

function Home({ currentUser, onNavigate, onOpenCall, onStartUpload, refreshKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [calls, setCalls] = useState([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const isManager = currentUser.role === 'Manager'

  useEffect(() => {
    let isMounted = true

    async function loadHome() {
      setIsLoading(true)
      setMessage('')

      try {
        const dashboardPath = isManager
          ? '/api/dashboard/manager'
          : `/api/dashboard/employee/${encodeURIComponent(currentUser.employeeId)}`
        const response = await fetch(`${API_BASE_URL}${dashboardPath}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load home summary.')
        }

        if (!isMounted) {
          return
        }

        setDashboard(payload.dashboard || null)
        setCalls(payload.calls || payload.dashboard?.recentCalls || [])
      } catch (error) {
        if (isMounted) {
          setDashboard(null)
          setCalls([])
          setMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadHome()

    return () => {
      isMounted = false
    }
  }, [currentUser.employeeId, isManager, refreshKey])

  const home = useMemo(
    () => buildHomeModel(currentUser, dashboard, calls),
    [calls, currentUser, dashboard],
  )

  return (
    <section className="home-page" aria-label="Home">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">CALL CENTER AI</p>
          <h2>
            {home.greeting}, <span>{home.firstName}</span>
          </h2>
          <p>{home.summary}</p>
          <div className="home-actions">
            <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
              Upload Call
            </button>
            <button
              className="secondary-button compact-action"
              type="button"
              onClick={() => onNavigate('dashboard', '')}
            >
              Open Dashboard
            </button>
          </div>
          {message ? <p className="home-inline-message">{message}</p> : null}
        </div>

        <aside className="home-profile-panel" aria-label="Employee profile snapshot">
          <div className="home-avatar-ring">
            <div className="home-avatar">{home.initials}</div>
          </div>
          <div>
            <strong>{currentUser.fullName}</strong>
            <span>{currentUser.role}</span>
          </div>
          <div className="home-profile-grid">
            <ProfileStat label="Employee ID" value={currentUser.employeeId} />
            <ProfileStat label="Status" value="Online" />
            <ProfileStat label="Calls" value={home.totalCalls} />
            <ProfileStat label="Score" value={home.overallScore} />
          </div>
        </aside>
      </section>

      <section className="home-metric-grid" aria-label="Today summary">
        {home.metrics.map((metric) => (
          <article className={`home-metric-card home-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="home-command-grid" aria-label="Navigation shortcuts">
        {quickLinks.map((item) => (
          <button
            className={`home-command-card home-command-${item.tone}`}
            type="button"
            key={item.title}
            onClick={() => onNavigate(item.view, item.focus)}
          >
            <span aria-hidden="true">{item.label}</span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </section>

      <section className="home-lower-grid">
        <article className="dashboard-panel home-trend-panel">
          <PanelHeader title="Performance Trend" meta={isLoading ? 'Loading latest data' : 'Recent evaluated calls'} />
          <HomeTrendChart trend={home.trend} />
        </article>

        <article className="dashboard-panel home-coach-panel">
          <PanelHeader title="AI Coach Insight" meta="Next best action" />
          <div className="home-coach-body">
            <div className="home-coach-bot" aria-hidden="true">
              AI
            </div>
            <p>{home.aiCoach}</p>
          </div>
          <div className="home-skill-list">
            {home.skills.map((skill) => (
              <div className="home-skill-row" key={skill.name}>
                <span>{skill.name}</span>
                <strong>{toTenPointScore(skill.score)}</strong>
                <div>
                  <i style={{ width: `${Math.max(0, Math.min(100, Number(skill.score) || 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel home-recent-panel">
          <PanelHeader title="Recent Calls" meta="Open a call evaluation" />
          {home.recentCalls.length ? (
            <div className="home-call-list">
              {home.recentCalls.map((call) => (
                <button className="home-call-row" type="button" key={call.id} onClick={() => onOpenCall(call.id)}>
                  <span>
                    <strong>{call.filename || call.summary?.customerIssue || 'Recorded call'}</strong>
                    <small>{formatDate(call.createdAt)}</small>
                  </span>
                  <b>{toTenPointScore(call.evaluation?.metrics?.overallScore || 0)}</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="home-empty-state">
              <strong>No calls yet</strong>
              <span>Upload a recorded conversation to unlock scoring, transcripts, and coaching.</span>
            </div>
          )}
        </article>
      </section>
    </section>
  )
}

function PanelHeader({ title, meta }) {
  return (
    <div className="panel-heading tight-heading">
      <div>
        <h2>{title}</h2>
        <p className="result-meta">{meta}</p>
      </div>
    </div>
  )
}

function ProfileStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  )
}

function HomeTrendChart({ trend }) {
  const data = normalizeTrend(trend)
  const points = data
    .map((item, index) => {
      const x = 18 + index * (264 / Math.max(data.length - 1, 1))
      const y = 130 - (Math.max(0, Math.min(100, item.score)) / 100) * 106
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="home-trend-chart">
      <svg viewBox="0 0 300 150" role="img" aria-label="Home performance trend">
        <path d="M18 130H282" />
        <path d="M18 96H282" />
        <path d="M18 62H282" />
        <polyline points={points} />
        {data.map((item, index) => {
          const x = 18 + index * (264 / Math.max(data.length - 1, 1))
          const y = 130 - (Math.max(0, Math.min(100, item.score)) / 100) * 106
          return <circle cx={x} cy={y} r="4" key={`${item.label}-${index}`} />
        })}
      </svg>
      <div className="trend-label-row">
        {data.map((item, index) => (
          <span key={`${item.label}-${index}`}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

function buildHomeModel(currentUser, dashboard, calls) {
  const latestCall = dashboard?.latestCall || dashboard?.recentCalls?.[0] || calls?.[0] || {}
  const latestEvaluation = latestCall.evaluation || {}
  const satisfactionScore =
    latestEvaluation.predictedSatisfaction?.score ||
    latestCall.summary?.predictedCustomerSatisfaction ||
    dashboard?.averageSatisfaction ||
    0
  const overallRaw =
    dashboard?.overallPerformance ||
    latestEvaluation.metrics?.overallScore ||
    0
  const skillSource =
    dashboard?.skillGaps ||
    latestEvaluation.skillGapAnalysis?.skills ||
    [
      { name: 'Communication', score: overallRaw },
      { name: 'Empathy', score: latestEvaluation.metrics?.empathy?.score || overallRaw },
      { name: 'Problem Solving', score: overallRaw },
    ]
  const totalCalls = dashboard?.totalCalls || calls?.length || 0
  const firstName = currentUser.fullName?.split(' ')[0] || currentUser.fullName || 'there'
  const greeting = timeGreeting()
  const aiCoach =
    dashboard?.aiCoach ||
    latestEvaluation.coachingReport?.summary ||
    'Upload and review calls regularly to build a stronger coaching profile.'

  return {
    firstName,
    initials: initials(currentUser.fullName),
    greeting,
    totalCalls,
    overallScore: toTenPointScore(overallRaw),
    aiCoach,
    skills: skillSource.slice(0, 4),
    trend: dashboard?.performanceTrend || [],
    recentCalls: (calls || dashboard?.recentCalls || []).slice(0, 4),
    summary:
      totalCalls > 0
        ? 'Your live summary is ready. Jump into calls, coaching, performance, or reports from one clean home base.'
        : 'Start by uploading a call. Your home page will fill with scores, trends, coaching, and recent conversations.',
    metrics: [
      {
        label: 'Overall Score',
        value: `${toTenPointScore(overallRaw)}/10`,
        detail: `${formatGrowth(dashboard?.thisWeekGrowth)} this week`,
        tone: 'blue',
      },
      {
        label: 'Calls Handled',
        value: String(totalCalls),
        detail: 'Evaluated calls',
        tone: 'purple',
      },
      {
        label: 'Customer Satisfaction',
        value: `${toTenPointScore(satisfactionScore)}/10`,
        detail: 'Predicted CSAT',
        tone: 'green',
      },
      {
        label: 'Coach Rating',
        value: ratingLabel(overallRaw),
        detail: totalCalls > 0 ? 'Based on latest calls' : 'Waiting for calls',
        tone: 'amber',
      },
    ],
  }
}

function normalizeTrend(trend = []) {
  if (trend.length) {
    return trend.slice(-7).map((item) => ({
      label: item.label,
      score: Number(item.score) || 0,
    }))
  }

  return [
    { label: 'Mon', score: 34 },
    { label: 'Tue', score: 42 },
    { label: 'Wed', score: 50 },
    { label: 'Thu', score: 58 },
    { label: 'Fri', score: 66 },
    { label: 'Sat', score: 72 },
    { label: 'Sun', score: 76 },
  ]
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

function timeGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function ratingLabel(value) {
  const numeric = Number(value) || 0

  if (numeric >= 85) {
    return 'Excellent'
  }

  if (numeric >= 70) {
    return 'Good'
  }

  if (numeric >= 50) {
    return 'Improving'
  }

  return 'Needs Focus'
}

function toTenPointScore(value) {
  const numeric = Number(value) || 0
  return (Math.max(0, Math.min(100, numeric)) / 10).toFixed(1)
}

function formatGrowth(value) {
  const numeric = Number(value) || 0
  const prefix = numeric > 0 ? '+' : ''
  return `${prefix}${numeric}%`
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default Home
