import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api.js'

function CallDetails({ callId, onBack }) {
  const [call, setCall] = useState(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(callId))

  useEffect(() => {
    let isMounted = true

    async function loadCall() {
      if (!callId) {
        setMessage('Select a call to view details.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessage('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/calls/${encodeURIComponent(callId)}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load call details.')
        }

        if (isMounted) {
          setCall(payload.call)
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
  }, [callId])

  const evaluation = call?.evaluation || {}
  const summary = evaluation.callSummary || {}
  const coaching = evaluation.coachingReport || {}
  const satisfaction = evaluation.predictedSatisfaction || {}
  const miscommunication = evaluation.miscommunication || {}
  const resolution = evaluation.resolutionAnalysis || {}
  const skillGap = evaluation.skillGapAnalysis || {}
  const transcriptLines = useMemo(
    () => (call?.segments || []).map((segment) => ({
      ...segment,
      timeLabel: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
      speakerRole: getSpeakerRole(segment.speaker),
    })),
    [call],
  )

  if (isLoading) {
    return <div className="loading-panel">Loading call details...</div>
  }

  if (message) {
    return (
      <section className="empty-dashboard">
        <h2>Call details unavailable</h2>
        <p>{message}</p>
        <button className="primary-button compact-action" type="button" onClick={onBack}>
          Back to Home
        </button>
      </section>
    )
  }

  if (!call) {
    return null
  }

  return (
    <section className="call-detail-grid" aria-label="Call details">
      <section className="dashboard-panel wide-panel detail-hero">
        <button className="text-button detail-back" type="button" onClick={onBack}>
          Back to Home
        </button>
        <div>
          <p className="eyebrow">Call Summary</p>
          <h2>{summary.customerIssue || 'Customer support request'}</h2>
          <p className="detail-subtitle">
            {call.employeeName || call.employeeId} / {formatDate(call.createdAt)} / {formatTime(call.duration)}
          </p>
        </div>
        <div className="summary-grid">
          <SummaryItem label="Resolution Status" value={summary.resolutionStatus || resolution.status} />
          <SummaryItem label="Customer Emotion" value={summary.customerEmotion || 'Neutral'} />
          <SummaryItem label="Agent Communication" value={summary.agentCommunication || 'Not evaluated'} />
          <SummaryItem label="Predicted Satisfaction" value={`${satisfaction.score || 0}%`} />
        </div>
      </section>

      <section className="dashboard-panel">
        <PanelTitle title="Customer Satisfaction Prediction" />
        <div className="satisfaction-card">
          <strong>{satisfaction.score || 0}%</strong>
          <span>{satisfaction.label || 'Not evaluated'}</span>
        </div>
        <InsightList items={satisfaction.reason || []} />
        {satisfaction.followUpRecommended ? <p className="follow-up">Follow-up recommended.</p> : null}
      </section>

      <section className="dashboard-panel">
        <PanelTitle title="Miscommunication Detection" />
        <StatusPill active={miscommunication.detected}>
          {miscommunication.detected ? 'Miscommunication Detected' : 'No Major Miscommunication'}
        </StatusPill>
        <div className="comparison-grid">
          <SummaryItem label="Customer Requested" value={miscommunication.customerRequested || 'General support'} />
          <SummaryItem label="Agent Responded About" value={miscommunication.agentRespondedAbout || 'General support'} />
        </div>
        <p className="quiet-text">{miscommunication.recommendation}</p>
      </section>

      <section className="dashboard-panel">
        <PanelTitle title="Resolution Analysis" />
        <StatusPill active={resolution.status !== 'Resolved'}>{resolution.status || 'Not evaluated'}</StatusPill>
        <InsightList items={resolution.reason || []} />
        <p className="follow-up">{resolution.recommendedFollowUp}</p>
      </section>

      <section className="dashboard-panel">
        <PanelTitle title="Skill Gap Analysis" />
        <SkillBars skills={skillGap.skills || []} />
        <div className="gap-priority">
          <SummaryItem label="Biggest Skill Gap" value={skillGap.biggestSkillGap || 'None'} />
          <SummaryItem label="Priority" value={skillGap.priority || 'Low'} />
        </div>
      </section>

      <section className="dashboard-panel wide-panel">
        <PanelTitle title="AI Coaching" />
        <p className="coach-note">{coaching.summary}</p>
        <div className="coaching-columns">
          <div>
            <h3>Strengths</h3>
            <InsightList items={coaching.strengths || []} />
          </div>
          <div>
            <h3>Weaknesses</h3>
            <InsightList items={coaching.weaknesses || []} />
          </div>
          <div>
            <h3>Coaching Tips</h3>
            <InsightList items={coaching.tips || summary.coachingTips || []} />
          </div>
        </div>
      </section>

      <section className="dashboard-panel">
        <PanelTitle title="Recommended Training" />
        <InsightList items={evaluation.recommendedLearning || []} />
      </section>

      <section className="dashboard-panel wide-panel transcript-detail-panel">
        <PanelTitle title="Transcript" />
        <div className="script-content detail-script">
          {transcriptLines.length ? (
            transcriptLines.map((segment) => (
              <article
                className={`script-line ${segment.speakerRole.className}`}
                key={segment.id}
              >
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
            <p className="script-plain">{call.displayTranscript || call.transcript}</p>
          )}
        </div>
      </section>
    </section>
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

function PanelTitle({ title }) {
  return (
    <div className="panel-heading tight-heading">
      <h2>{title}</h2>
    </div>
  )
}

function StatusPill({ active, children }) {
  return <span className={active ? 'status-pill warning' : 'status-pill success'}>{children}</span>
}

function InsightList({ items }) {
  if (!items.length) {
    return <p className="quiet-text">No insight available.</p>
  }

  return (
    <ul className="insight-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function SkillBars({ skills }) {
  if (!skills.length) {
    return <p className="quiet-text">No skill data yet.</p>
  }

  return (
    <div className="skill-list">
      {skills.map((skill) => (
        <div className="skill-row" key={skill.name}>
          <div className="skill-meta">
            <span>{skill.name}</span>
            <strong>{skill.score}%</strong>
          </div>
          <div className="skill-track">
            <span style={{ width: `${Math.max(0, Math.min(100, skill.score || 0))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(Number(seconds), 0) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = Math.floor(safeSeconds % 60)

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

export default CallDetails
