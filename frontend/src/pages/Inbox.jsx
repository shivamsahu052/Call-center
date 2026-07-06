import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function Inbox({ currentUser }) {
  const { decideApproval, loadInbox, markInboxMessageRead } = useAuth()
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [actingKey, setActingKey] = useState('')

  async function refreshInbox() {
    setIsLoading(true)
    setNotice('')

    const result = await loadInbox()

    if (!result.ok) {
      setNotice(result.message)
      setIsLoading(false)
      return
    }

    setMessages(result.messages || [])
    setUnreadCount(result.unreadCount || 0)
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setNotice('')

      const result = await loadInbox()

      if (!isMounted) {
        return
      }

      if (!result.ok) {
        setNotice(result.message)
        setIsLoading(false)
        return
      }

      setMessages(result.messages || [])
      setUnreadCount(result.unreadCount || 0)
      setIsLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [currentUser.employeeId, currentUser.role, loadInbox])

  async function handleDecision(message, decision) {
    setActingKey(`${message.id}-${decision}`)
    setNotice('')

    const result = await decideApproval(message.approvalId, decision)

    if (!result.ok) {
      setNotice(result.message)
      setActingKey('')
      return
    }

    setNotice(result.message)
    await refreshInbox()
    setActingKey('')
  }

  async function handleMarkRead(message) {
    setActingKey(`${message.id}-read`)
    setNotice('')

    const result = await markInboxMessageRead(message.id)

    if (!result.ok) {
      setNotice(result.message)
      setActingKey('')
      return
    }

    await refreshInbox()
    setActingKey('')
  }

  if (isLoading) {
    return <div className="loading-panel">Loading inbox...</div>
  }

  return (
    <section className="inbox-page" aria-label="Inbox">
      <section className="dashboard-panel inbox-hero-panel">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Messages</h2>
          <p className="detail-subtitle">{unreadCount} unread</p>
        </div>
        <button className="secondary-button inbox-refresh-button" type="button" onClick={refreshInbox}>
          Refresh
        </button>
      </section>

      {notice ? <p className="form-message success inbox-notice">{notice}</p> : null}

      <section className="inbox-list" aria-label="Inbox messages">
        {messages.length ? (
          messages.map((message) => (
            <InboxMessage
              key={message.id}
              message={message}
              currentUser={currentUser}
              actingKey={actingKey}
              onDecision={handleDecision}
              onMarkRead={handleMarkRead}
            />
          ))
        ) : (
          <section className="dashboard-panel inbox-empty">
            <h2>No messages yet</h2>
            <p className="detail-subtitle">New account updates will appear here.</p>
          </section>
        )}
      </section>
    </section>
  )
}

function InboxMessage({ message, currentUser, actingKey, onDecision, onMarkRead }) {
  const isPendingApproval =
    currentUser.role === 'Manager' &&
    message.type === 'approval_request' &&
    message.approvalStatus === 'pending'
  const isUnread = message.status === 'unread'
  const statusLabel = message.approvalStatus || message.status || 'unread'

  return (
    <article className={isUnread ? 'dashboard-panel inbox-message unread' : 'dashboard-panel inbox-message'}>
      <div className="inbox-message-main">
        <div>
          <p className="eyebrow">{message.requesterRole || message.type}</p>
          <h2>{message.title}</h2>
          <p>{message.body}</p>
        </div>
        <span className={`inbox-status inbox-status-${statusLabel}`}>{statusLabel}</span>
      </div>

      {message.requesterName || message.requesterEmail ? (
        <div className="inbox-meta-grid">
          <InboxMeta label="Name" value={message.requesterName} />
          <InboxMeta label="Email" value={message.requesterEmail} />
          <InboxMeta label="Received" value={formatDate(message.createdAt)} />
        </div>
      ) : (
        <p className="result-meta">{formatDate(message.createdAt)}</p>
      )}

      <div className="inbox-actions">
        {isPendingApproval ? (
          <>
            <button
              className="primary-button inbox-action-button"
              type="button"
              onClick={() => onDecision(message, 'approved')}
              disabled={Boolean(actingKey)}
            >
              {actingKey === `${message.id}-approved` ? 'Approving...' : 'Approve'}
            </button>
            <button
              className="secondary-button inbox-action-button"
              type="button"
              onClick={() => onDecision(message, 'rejected')}
              disabled={Boolean(actingKey)}
            >
              {actingKey === `${message.id}-rejected` ? 'Rejecting...' : 'Reject'}
            </button>
          </>
        ) : null}

        {isUnread ? (
          <button
            className="text-button"
            type="button"
            onClick={() => onMarkRead(message)}
            disabled={Boolean(actingKey)}
          >
            {actingKey === `${message.id}-read` ? 'Updating...' : 'Mark read'}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function InboxMeta({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Not available'}</strong>
    </div>
  )
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

export default Inbox
