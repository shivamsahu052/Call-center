import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api.js'

function Dashboard({ currentUser, onOpenCall, onStartUpload, focusSection = '', refreshKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [calls, setCalls] = useState([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const isManager = currentUser.role === 'Manager'

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setMessage('')

      try {
        const dashboardPath = isManager
          ? '/api/dashboard/manager'
          : `/api/dashboard/employee/${encodeURIComponent(currentUser.employeeId)}`
        const response = await fetch(`${API_BASE_URL}${dashboardPath}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load dashboard.')
        }

        if (!isMounted) {
          return
        }

        setDashboard(payload.dashboard)
        setCalls(payload.calls || payload.dashboard?.recentCalls || [])
      } catch (error) {
        if (isMounted) {
          setMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [currentUser.employeeId, isManager, refreshKey])

  if (isLoading) {
    return <div className="loading-panel">Loading dashboard...</div>
  }

  if (message) {
    return (
      <section className="empty-dashboard">
        <h2>Dashboard unavailable</h2>
        <p>{message}</p>
        <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
          Upload Call
        </button>
      </section>
    )
  }

  if (!dashboard || dashboard.totalCalls === 0) {
    return (
      <section className="empty-dashboard">
        <h2>No evaluated calls yet</h2>
        <p>Upload a recorded call to generate transcripts, coaching, skill gaps, leaderboards, and reports.</p>
        <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
          Upload Call
        </button>
      </section>
    )
  }

  return (
    <DashboardHome
      currentUser={currentUser}
      dashboard={dashboard}
      calls={calls}
      focusSection={focusSection}
      onOpenCall={onOpenCall}
      onStartUpload={onStartUpload}
    />
  )
}

export function LeaderboardView({ currentUser, refreshKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadLeaderboard() {
      setIsLoading(true)
      setMessage('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/manager`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load leaderboard.')
        }

        if (isMounted) {
          setDashboard(payload.dashboard)
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadLeaderboard()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  if (isLoading) {
    return <div className="loading-panel">Loading leaderboard...</div>
  }

  if (message) {
    return (
      <section className="empty-dashboard">
        <h2>Leaderboard unavailable</h2>
        <p>{message}</p>
      </section>
    )
  }

  const employees = dashboard?.employees?.length ? dashboard.employees : dashboard?.leaderboard || []
  const podium = employees.slice(0, 3)

  return (
    <section className="leaderboard-page leaderboard-full-page" aria-label="Leaderboard">
      <section className="dashboard-panel leaderboard-stage">
        <div>
          <p className="eyebrow">Leaderboard</p>
          <h2>Top performers this week</h2>
          <p className="detail-subtitle">Ranked from evaluated calls stored in MongoDB.</p>
        </div>
        <div className="leaderboard-podium" aria-label="Top three employees">
          {podium.map((employee, index) => (
            <article className={`podium-card podium-${index + 1}`} key={employee.employeeId || employee.fullName}>
              <span className="podium-rank">#{index + 1}</span>
              <div className="podium-avatar">{initials(employee.fullName)}</div>
              <strong>{employee.fullName || 'Employee'}</strong>
              <span>{toTenPointScore(employee.overallPerformance)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-panel">
        <PanelHeader title="Full Leaderboard" meta="Current ranked employees" />
        <LeaderboardTable employees={employees} currentUser={currentUser} />
      </section>
    </section>
  )
}

function DashboardHome({ currentUser, dashboard, calls, focusSection, onOpenCall, onStartUpload }) {
  const employee = normalizeEmployeeDashboard(currentUser, dashboard, calls)
  const leaderboard = dashboard.leaderboard || dashboard.employees || []

  if (focusSection) {
    return (
      <FocusedDashboardSection
        focusSection={focusSection}
        employee={employee}
        dashboard={dashboard}
        calls={calls}
        leaderboard={leaderboard}
        currentUser={currentUser}
        onOpenCall={onOpenCall}
        onStartUpload={onStartUpload}
      />
    )
  }

  const metrics = [
    {
      label: 'Overall Score',
      value: `${employee.overallScore}/10`,
      detail: `${formatGrowth(dashboard.thisWeekGrowth)} this week`,
      tone: 'blue',
    },
    {
      label: 'Calls Handled',
      value: String(employee.totalCalls),
      detail: 'Evaluated calls',
      tone: 'purple',
    },
    {
      label: 'Customer Satisfaction',
      value: `${employee.customerSatisfaction}/10`,
      detail: 'Predicted CSAT',
      tone: 'green',
    },
    {
      label: 'AI Coach Rating',
      value: ratingLabel(employee.overallRaw),
      detail: employee.aiCoach,
      tone: 'amber',
    },
  ]

  return (
    <section className="employee-dashboard-page" aria-label="Employee dashboard overview">
      <section className="employee-hero-panel">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">Performance overview</p>
            <h2>Welcome back, {employee.firstName}</h2>
            <p className="detail-subtitle">Here is your call performance overview.</p>
          </div>
          <span className="status-pill">{employee.totalCalls} calls</span>
        </div>

        <div className="dashboard-metric-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="dashboard-overview-grid">
          <section className="dashboard-subpanel trend-overview-panel">
            <PanelHeader title="Performance Trend" meta="Recent evaluated calls" />
            <TrendLineChart trend={employee.trend} />
          </section>

          <section className="dashboard-subpanel skill-overview-panel">
            <PanelHeader title="Skill Breakdown" meta="Average skill signals" />
            <SkillBars skills={dashboard.skillGaps || employee.skillFallback} />
          </section>
        </div>

        <div className="dashboard-overview-grid lower">
          <section className="dashboard-subpanel">
            <PanelHeader title="Recent Calls" meta="Latest transcript and analysis" />
            <CallTable calls={calls || dashboard.recentCalls || []} onOpenCall={onOpenCall} />
          </section>

          <section className="dashboard-subpanel ai-insight-card">
            <PanelHeader title="AI Insights" meta="Next best actions" />
            <p className="coach-note">{employee.aiCoach}</p>
            <MarkedList items={employee.recommendedLearning} mark="dot" />
            <button className="secondary-button inline-action" type="button" onClick={onStartUpload}>
              Upload New Call
            </button>
          </section>
        </div>
      </section>
    </section>
  )
}

function FocusedDashboardSection({
  focusSection,
  employee,
  dashboard,
  calls,
  leaderboard,
  currentUser,
  onOpenCall,
  onStartUpload,
}) {
  if (focusSection === 'calls') {
    return <CallsPage calls={calls || dashboard.recentCalls || []} onOpenCall={onOpenCall} onStartUpload={onStartUpload} />
  }

  if (focusSection === 'transcripts') {
    return <TranscriptExplorer calls={calls || dashboard.recentCalls || []} onOpenCall={onOpenCall} />
  }

  if (focusSection === 'coach') {
    return <AICoachPage employee={employee} />
  }

  if (focusSection === 'reports') {
    return <ReportsPage employee={employee} dashboard={dashboard} calls={calls || dashboard.recentCalls || []} />
  }

  if (focusSection === 'performance') {
    return <PerformancePage employee={employee} dashboard={dashboard} calls={calls || dashboard.recentCalls || []} />
  }

  if (focusSection === 'training') {
    return <TrainingPage employee={employee} dashboard={dashboard} calls={calls || dashboard.recentCalls || []} onStartUpload={onStartUpload} />
  }

  return (
    <section className="focused-dashboard" aria-label="Dashboard section">
      <section className="dashboard-panel">
        <PanelHeader title="Performance" meta="Current evaluation summary" />
        <div className="score-list">
          <ScoreLine label="Overall Score" value={employee.overallScore} />
          <ScoreLine label="Communication" value={employee.communication} />
          <ScoreLine label="Empathy" value={employee.empathy} />
          <ScoreLine label="Problem Solving" value={employee.problemSolving} />
        </div>
      </section>

      <section className="dashboard-panel">
        <PanelHeader title="Leaderboard" meta="Team context" />
        <LeaderboardTable employees={leaderboard} currentUser={currentUser} compact />
      </section>
    </section>
  )
}

function CallsPage({ calls, onOpenCall, onStartUpload }) {
  return (
    <section className="calls-page" aria-label="My calls">
      <section className="dashboard-panel page-hero-panel">
        <div>
          <p className="eyebrow">My Calls</p>
          <h2>Reviewed conversations</h2>
          <p className="detail-subtitle">Open any call to view transcript, sentiment, coaching, and skill gaps.</p>
        </div>
        <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
          Upload Call
        </button>
      </section>
      <section className="dashboard-panel">
        <CallTable calls={calls} onOpenCall={onOpenCall} />
      </section>
    </section>
  )
}

function TranscriptExplorer({ calls, onOpenCall }) {
  const [selectedId, setSelectedId] = useState(calls[0]?.id || '')
  const [selectedCall, setSelectedCall] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(calls[0]?.id))
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('transcript')

  useEffect(() => {
    if (!selectedId && calls[0]?.id) {
      setSelectedId(calls[0].id)
    }
  }, [calls, selectedId])

  useEffect(() => {
    let isMounted = true

    async function loadCall() {
      if (!selectedId) {
        setSelectedCall(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessage('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/calls/${encodeURIComponent(selectedId)}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load transcript.')
        }

        if (isMounted) {
          setSelectedCall(payload.call)
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCall()

    return () => {
      isMounted = false
    }
  }, [selectedId])

  const selectedSummary = calls.find((call) => call.id === selectedId)
  const call = selectedCall || selectedSummary
  const evaluation = call?.evaluation || {}
  const transcriptLines = useMemo(
    () => (selectedCall?.segments || []).map((segment) => ({
      ...segment,
      timeLabel: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
      speakerRole: getSpeakerRole(segment.speaker),
    })),
    [selectedCall],
  )

  if (!calls.length) {
    return (
      <section className="empty-dashboard">
        <h2>No transcripts yet</h2>
        <p>Upload evaluated calls to build the transcript workspace.</p>
      </section>
    )
  }

  return (
    <section className="transcript-page" aria-label="Transcripts">
      <section className="dashboard-panel transcript-list-panel">
        <PanelHeader title="Call Transcripts" meta="Select a call" />
        <div className="transcript-call-list">
          {calls.map((item) => (
            <button
              className={item.id === selectedId ? 'transcript-call active' : 'transcript-call'}
              type="button"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>{item.filename || item.summary?.customerIssue || 'Recorded call'}</strong>
              <span>{formatDate(item.createdAt)}</span>
              <small>{toTenPointScore(item.evaluation?.metrics?.overallScore || 0)} score</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-panel transcript-reader-panel">
        <div className="transcript-header-row">
          <div>
            <p className="eyebrow">Transcript</p>
            <h2>{call?.summary?.customerIssue || call?.filename || 'Selected call'}</h2>
            <p className="detail-subtitle">
              {call?.employeeName || call?.employeeId || 'Employee'} / {formatDate(call?.createdAt)}
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={() => onOpenCall?.(selectedId)}>
            Full Analysis
          </button>
        </div>

        <div className="workspace-tabs compact-tabs" role="tablist" aria-label="Transcript tabs">
          <button
            className={activeTab === 'transcript' ? 'tab-button active' : 'tab-button'}
            type="button"
            onClick={() => setActiveTab('transcript')}
          >
            Transcript
          </button>
          <button
            className={activeTab === 'analysis' ? 'tab-button active' : 'tab-button'}
            type="button"
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
        </div>

        {isLoading ? <p className="quiet-text">Loading transcript...</p> : null}
        {message ? <p className="form-message error">{message}</p> : null}

        {!isLoading && !message && activeTab === 'transcript' ? (
          <div className="script-content transcript-scroll">
            {transcriptLines.length ? (
              transcriptLines.map((segment) => (
                <article className={`script-line ${segment.speakerRole.className}`} key={segment.id}>
                  <div className="script-line-meta">
                    <span className="speaker-label">
                      {segment.speakerRole.label}
                      {segment.speakerRole.detail ? <small>{segment.speakerRole.detail}</small> : null}
                    </span>
                    <time>{segment.timeLabel}</time>
                  </div>
                  <p>{segment.text}</p>
                </article>
              ))
            ) : (
              <p className="script-plain">{selectedCall?.displayTranscript || selectedCall?.transcript || 'No transcript text available.'}</p>
            )}
          </div>
        ) : null}

        {!isLoading && !message && activeTab === 'analysis' ? (
          <TranscriptAnalysis evaluation={evaluation} />
        ) : null}
      </section>

      <aside className="dashboard-panel transcript-ai-panel">
        <PanelHeader title="AI Analysis" meta="Conversation quality" />
        <ScoreRing value={evaluation.metrics?.overallScore || 0} label="Overall Score" />
        <SkillBars skills={evaluation.skillGapAnalysis?.skills || []} />
        <section className="sentiment-box">
          <strong>{evaluation.predictedSatisfaction?.label || 'Customer sentiment'}</strong>
          <span>{evaluation.predictedSatisfaction?.score || 0}% confidence</span>
        </section>
        <MarkedList
          items={[
            ...(evaluation.coachingReport?.strengths || []),
            ...(evaluation.coachingReport?.weaknesses || []),
          ].slice(0, 5)}
          mark="dot"
        />
      </aside>
    </section>
  )
}

function TranscriptAnalysis({ evaluation }) {
  const summary = evaluation.callSummary || {}
  const resolution = evaluation.resolutionAnalysis || {}

  return (
    <div className="transcript-analysis-grid">
      <SummaryItem label="Resolution" value={summary.resolutionStatus || resolution.status} />
      <SummaryItem label="Customer Emotion" value={summary.customerEmotion || 'Neutral'} />
      <SummaryItem label="Satisfaction" value={`${evaluation.predictedSatisfaction?.score || 0}%`} />
      <SummaryItem label="Skill Gap" value={evaluation.skillGapAnalysis?.biggestSkillGap || 'None'} />
      <div className="summary-item wide-summary">
        <span>Coach Summary</span>
        <strong>{evaluation.coachingReport?.summary || 'No coach summary available.'}</strong>
      </div>
    </div>
  )
}

function AICoachPage({ employee }) {
  const [messages, setMessages] = useState([
    {
      role: 'coach',
      text: employee.aiCoach,
    },
  ])
  const [draft, setDraft] = useState('')

  const prompts = [
    'How can I improve empathy?',
    'What should I practice today?',
    'Why is my score changing?',
    'How do I handle objections?',
  ]

  function sendCoachMessage(text = draft) {
    const question = text.trim()

    if (!question) {
      return
    }

    setMessages((current) => [
      ...current,
      { role: 'user', text: question },
      { role: 'coach', text: buildCoachReply(question, employee) },
    ])
    setDraft('')
  }

  return (
    <section className="ai-coach-page" aria-label="AI Coach">
      <section className="dashboard-panel ai-coach-hero">
        <div>
          <p className="eyebrow">AI Coach</p>
          <h2>Your personal performance coach</h2>
          <p className="detail-subtitle">Ask common questions or use the recommended FAQ prompts.</p>
        </div>
        <div className="coach-bot" aria-hidden="true">
          <span>AI</span>
        </div>
      </section>

      <section className="dashboard-panel coach-feedback-panel">
        <PanelHeader title="Personalized Feedback" meta="Based on evaluated calls" />
        <div className="insight-columns">
          <section>
            <h3>Strengths</h3>
            <MarkedList items={employee.strengths} mark="check" />
          </section>
          <section>
            <h3>Weaknesses</h3>
            <MarkedList items={employee.weaknesses} mark="cross" />
          </section>
        </div>
      </section>

      <section className="dashboard-panel coach-chat-panel">
        <PanelHeader title="FAQ Chatbot" meta="Instant coaching FAQ" />
        <div className="faq-chip-row">
          {prompts.map((prompt) => (
            <button className="tab-button" type="button" key={prompt} onClick={() => sendCoachMessage(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <div className="coach-chat-log">
          {messages.map((message, index) => (
            <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <span>{message.role === 'coach' ? 'AI Coach' : 'You'}</span>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
        <form
          className="coach-chat-form"
          onSubmit={(event) => {
            event.preventDefault()
            sendCoachMessage()
          }}
        >
          <input
            type="text"
            value={draft}
            placeholder="Ask about empathy, score, training, or calls"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="primary-button" type="submit">
            Ask
          </button>
        </form>
      </section>

    </section>
  )
}

function TrainingPage({ employee, dashboard, calls, onStartUpload }) {
  const recommendedLearning = employee.recommendedLearning?.length
    ? employee.recommendedLearning
    : ['Practice active listening', 'Confirm the issue before resolving', 'Close with a clear next step']
  const trainingCards = recommendedLearning.slice(0, 6).map((item, index) => ({
    title: item,
    detail: trainingDetailFor(index),
    level: index === 0 ? 'Priority' : 'Practice',
  }))
  const averageDuration = average(calls.map((call) => call.duration || 0))

  return (
    <section className="training-page" aria-label="Training">
      <section className="dashboard-panel page-hero-panel">
        <div>
          <p className="eyebrow">Training</p>
          <h2>Focused practice for your next calls</h2>
          <p className="detail-subtitle">
            Recommended from your evaluated calls, coaching gaps, and current score movement.
          </p>
        </div>
        <button className="primary-button compact-action" type="button" onClick={onStartUpload}>
          Upload Practice Call
        </button>
      </section>

      <div className="report-metric-grid">
        <MetricCard label="Current Score" value={`${employee.overallScore}/10`} detail="Overall" tone="blue" />
        <MetricCard label="Practice Calls" value={String(calls.length)} detail="Available" tone="purple" />
        <MetricCard label="Avg. Duration" value={formatTime(averageDuration)} detail="Per call" tone="green" />
        <MetricCard label="Focus Area" value={dashboard.skillGaps?.[0]?.name || 'Empathy'} detail="Lowest signal" tone="amber" />
      </div>

      <section className="dashboard-panel">
        <PanelHeader title="Recommended Training" meta="Start with the highest impact activity" />
        <div className="training-card-grid">
          {trainingCards.map((item) => (
            <article className="training-card" key={item.title}>
              <span>{item.level}</span>
              <strong>{item.title}</strong>
              <p className="quiet-text">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-overview-grid">
        <section className="dashboard-panel">
          <PanelHeader title="Skill Health" meta="Lowest skills first" />
          <SkillBars skills={dashboard.skillGaps || employee.skillFallback} />
        </section>

        <section className="dashboard-panel">
          <PanelHeader title="Coach Focus" meta="Weaknesses to practice" />
          <MarkedList items={employee.weaknesses} mark="cross" />
        </section>
      </div>
    </section>
  )
}

function ReportsPage({ employee, dashboard, calls }) {
  const averageDuration = average(calls.map((call) => call.duration || 0))
  const metrics = [
    { label: 'Average Score', value: `${employee.overallScore}/10`, detail: formatGrowth(dashboard.thisWeekGrowth) },
    { label: 'Total Calls', value: String(employee.totalCalls), detail: 'Evaluated' },
    { label: 'Avg. Duration', value: formatTime(averageDuration), detail: 'Per call' },
    { label: 'CSAT', value: `${employee.customerSatisfaction}/10`, detail: 'Predicted' },
  ]

  function downloadCsv() {
    const rows = [
      ['Call', 'Date', 'Score', 'Duration', 'Resolution'],
      ...calls.map((call) => [
        call.filename || call.id,
        formatDate(call.createdAt),
        toTenPointScore(call.evaluation?.metrics?.overallScore || 0),
        formatTime(call.duration || 0),
        call.summary?.resolutionStatus || 'Not evaluated',
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${employee.firstName || 'employee'}-report.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="reports-page" aria-label="Reports">
      <section className="dashboard-panel page-hero-panel">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Analyze your performance in detail</h2>
          <p className="detail-subtitle">Scores, calls, duration, and coaching signals from evaluated calls.</p>
        </div>
        <button className="secondary-button" type="button" onClick={downloadCsv}>
          Download CSV
        </button>
      </section>

      <div className="report-metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} tone="blue" />
        ))}
      </div>

      <section className="dashboard-panel report-chart-panel">
        <PanelHeader title="Performance Over Time" meta="Recent trend" />
        <TrendLineChart trend={employee.trend} tall />
      </section>

      <section className="dashboard-panel">
        <PanelHeader title="Call Report" meta="Export-ready call summary" />
        <CallTable calls={calls} onOpenCall={() => {}} passive />
      </section>
    </section>
  )
}

function PerformancePage({ employee, dashboard, calls }) {
  return (
    <section className="performance-page" aria-label="Performance">
      <section className="dashboard-panel page-hero-panel">
        <div>
          <p className="eyebrow">Performance</p>
          <h2>Score movement and skill health</h2>
          <p className="detail-subtitle">Your latest performance score is {employee.overallScore}/10 from {calls.length} recent calls.</p>
        </div>
      </section>

      <div className="dashboard-overview-grid">
        <section className="dashboard-panel">
          <PanelHeader title="Performance Trend" meta="Recent evaluated calls" />
          <TrendLineChart trend={employee.trend} tall />
        </section>
        <section className="dashboard-panel">
          <PanelHeader title="Skill Breakdown" meta="Lowest skills first" />
          <SkillBars skills={dashboard.skillGaps || employee.skillFallback} />
        </section>
      </div>
    </section>
  )
}

function LeaderboardTable({ employees, currentUser, compact = false }) {
  const ranked = employees.length ? employees : [fallbackLeaderboardEmployee(currentUser)]

  return (
    <div className={compact ? 'leaderboard-table compact' : 'leaderboard-table'}>
      <div className="leaderboard-table-head">
        <span>Rank</span>
        <span>Employee</span>
        <span>Score</span>
      </div>
      {ranked.slice(0, compact ? 5 : 12).map((employee, index) => (
        <article
          className={employee.employeeId === currentUser.employeeId ? 'leaderboard-table-row current' : 'leaderboard-table-row'}
          key={employee.employeeId || employee.fullName || index}
        >
          <span className="medal-rank">#{index + 1}</span>
          <strong>{employee.fullName || 'Employee'}</strong>
          <span>{toTenPointScore(employee.overallPerformance)}</span>
        </article>
      ))}
    </div>
  )
}

function MetricCard({ label, value, detail, tone = 'blue' }) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function ScoreRing({ value, label }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div className="score-ring large" style={{ '--score': `${score * 3.6}deg` }}>
      <span>{toTenPointScore(score)}</span>
      <small>{label}</small>
    </div>
  )
}

function ScoreLine({ label, value }) {
  return (
    <div className="score-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TrendLineChart({ trend, tall = false }) {
  const data = normalizeTrend(trend)
  const points = data
    .map((item, index) => {
      const x = 20 + index * (260 / Math.max(data.length - 1, 1))
      const y = 130 - (Math.max(0, Math.min(100, item.score)) / 100) * 105
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className={tall ? 'trend-line-chart tall' : 'trend-line-chart'}>
      <svg viewBox="0 0 300 150" role="img" aria-label="Performance trend chart">
        <path d="M20 130H280" />
        <path d="M20 95H280" />
        <path d="M20 60H280" />
        <polyline points={points} />
        {data.map((item, index) => {
          const x = 20 + index * (260 / Math.max(data.length - 1, 1))
          const y = 130 - (Math.max(0, Math.min(100, item.score)) / 100) * 105
          return <circle cx={x} cy={y} r="3.5" key={`${item.label}-${index}`} />
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

function SkillBars({ skills }) {
  const sortedSkills = useMemo(
    () => [...(skills || [])].sort((a, b) => (a.score || 0) - (b.score || 0)),
    [skills],
  )

  if (!sortedSkills.length) {
    return <p className="quiet-text">No skill data yet.</p>
  }

  return (
    <div className="skill-list">
      {sortedSkills.map((skill) => (
        <div className="skill-row" key={skill.name}>
          <div className="skill-meta">
            <span>{skill.name}</span>
            <strong>{toTenPointScore(skill.score)}</strong>
          </div>
          <div className="skill-track">
            <span style={{ width: `${Math.max(0, Math.min(100, skill.score || 0))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MarkedList({ items, mark }) {
  const className = mark === 'check' ? 'marked-list check' : mark === 'cross' ? 'marked-list cross' : 'marked-list'
  const safeItems = items?.length ? items : ['No insight available yet']

  return (
    <ul className={className}>
      {safeItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function CallTable({ calls, onOpenCall, passive = false }) {
  if (!calls.length) {
    return <p className="quiet-text">No calls available.</p>
  }

  return (
    <div className="call-table enhanced-call-table">
      <div className="call-table-head">
        <span>Call</span>
        <span>Sentiment</span>
        <span>Score</span>
        <span>Duration</span>
        <span>Date</span>
      </div>
      {calls.map((call) => {
        const content = (
          <>
            <span>
              <strong>{call.filename || call.summary?.customerIssue || 'Recorded call'}</strong>
              <small>{call.employeeName || call.employeeId}</small>
            </span>
            <span className="sentiment-pill">{call.summary?.customerEmotion || 'Neutral'}</span>
            <span className="mini-score">{toTenPointScore(call.evaluation?.metrics?.overallScore || 0)}</span>
            <span>{formatTime(call.duration || 0)}</span>
            <span>{formatDate(call.createdAt)}</span>
          </>
        )

        if (passive) {
          return (
            <article className="call-row" key={call.id}>
              {content}
            </article>
          )
        }

        return (
          <button className="call-row" type="button" key={call.id} onClick={() => onOpenCall(call.id)}>
            {content}
          </button>
        )
      })}
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  )
}

function normalizeEmployeeDashboard(currentUser, dashboard, calls) {
  const latestCall = dashboard.latestCall || dashboard.recentCalls?.[0] || calls?.[0] || {}
  const latestEvaluation = latestCall.evaluation || {}
  const skillScores = Object.fromEntries(
    (dashboard.skillGaps || latestEvaluation.skillGapAnalysis?.skills || []).map((skill) => [
      skill.name,
      skill.score,
    ]),
  )
  const empathyScore =
    skillScores.Empathy || latestEvaluation.metrics?.empathy?.score || dashboard.averageEmpathy || dashboard.overallPerformance
  const communicationScore = skillScores.Communication || dashboard.overallPerformance
  const problemSolvingScore = skillScores['Problem Solving'] || dashboard.overallPerformance
  const satisfactionScore =
    latestEvaluation.predictedSatisfaction?.score ||
    latestCall.summary?.predictedCustomerSatisfaction ||
    dashboard.averageSatisfaction ||
    0

  return {
    firstName: currentUser.fullName?.split(' ')[0] || currentUser.fullName || 'there',
    totalCalls: dashboard.totalCalls || calls?.length || 0,
    overallRaw: dashboard.overallPerformance || 0,
    overallScore: toTenPointScore(dashboard.overallPerformance),
    communication: toTenPointScore(communicationScore),
    empathy: toTenPointScore(empathyScore),
    problemSolving: toTenPointScore(problemSolvingScore),
    customerSatisfaction: toTenPointScore(satisfactionScore),
    strengths: dashboard.strengths || latestEvaluation.coachingReport?.strengths || ['Good greeting and clear opening'],
    weaknesses: dashboard.weaknesses || latestEvaluation.coachingReport?.weaknesses || ['Improve closing confirmation'],
    recommendedLearning:
      dashboard.recommendedLearning || latestEvaluation.recommendedLearning || ['Review active listening practice'],
    aiCoach:
      dashboard.aiCoach ||
      latestEvaluation.coachingReport?.summary ||
      'Keep confirming the customer issue before closing the conversation.',
    trend: dashboard.performanceTrend || [],
    skillFallback: [
      { name: 'Communication', score: communicationScore },
      { name: 'Empathy', score: empathyScore },
      { name: 'Problem Solving', score: problemSolvingScore },
    ],
  }
}

function buildCoachReply(question, employee) {
  const normalized = question.toLowerCase()

  if (normalized.includes('empathy')) {
    return `Your empathy score is ${employee.empathy}/10. Slow down before giving the solution, acknowledge the concern, and repeat the customer's issue in your own words.`
  }

  if (normalized.includes('score') || normalized.includes('changing')) {
    return `Your current score is ${employee.overallScore}/10. The biggest movement usually comes from call closing, issue confirmation, and resolution clarity.`
  }

  if (normalized.includes('objection') || normalized.includes('handle')) {
    return 'For objections, confirm the concern first, ask one clarifying question, then offer a specific next step with a clear time expectation.'
  }

  if (normalized.includes('practice') || normalized.includes('today') || normalized.includes('training')) {
    return `Practice this next: ${employee.recommendedLearning[0] || 'active listening and clear closing statements'}.`
  }

  return `Based on your latest calls, focus on this: ${employee.aiCoach}`
}

function normalizeTrend(trend = []) {
  if (trend.length) {
    return trend.slice(-7).map((item) => ({
      label: item.label,
      score: Number(item.score) || 0,
    }))
  }

  return [
    { label: 'Mon', score: 35 },
    { label: 'Tue', score: 48 },
    { label: 'Wed', score: 55 },
    { label: 'Thu', score: 62 },
    { label: 'Fri', score: 72 },
    { label: 'Sat', score: 68 },
    { label: 'Sun', score: 76 },
  ]
}

function fallbackLeaderboardEmployee(currentUser) {
  return {
    employeeId: currentUser.employeeId,
    fullName: currentUser.fullName,
    overallPerformance: 0,
  }
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'E'
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

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(Number(seconds), 0) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = Math.floor(safeSeconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
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

function getSpeakerRole(speaker = '') {
  const normalized = speaker.toLowerCase()

  if (normalized.includes('customer') || normalized.includes('speaker 2')) {
    return {
      label: 'Customer',
      detail: normalized === 'customer' ? '' : speaker,
      className: 'speaker-customer',
    }
  }

  if (normalized.includes('agent') || normalized.includes('speaker 1')) {
    return {
      label: 'Agent',
      detail: normalized === 'agent' ? '' : speaker,
      className: 'speaker-agent',
    }
  }

  return {
    label: speaker || 'Speaker',
    detail: '',
    className: 'speaker-unknown',
  }
}

function average(values) {
  const safeValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value))

  if (!safeValues.length) {
    return 0
  }

  return safeValues.reduce((total, value) => total + value, 0) / safeValues.length
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function trainingDetailFor(index) {
  const details = [
    'Use this as the first drill before your next customer call.',
    'Practice it with one recent transcript and note a stronger response.',
    'Apply it during the next upload so the coach can compare progress.',
    'Review two examples and write a short closing statement.',
    'Turn this into a three-minute daily warmup.',
    'Pair it with a manager review when a call feels difficult.',
  ]

  return details[index] || details[0]
}

export default Dashboard
