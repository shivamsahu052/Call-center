import { useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api.js'

const languageOptions = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
]

const outputLanguageOptions = [
  { value: 'hi', label: 'Hindi script' },
  { value: 'original', label: 'Original script' },
]

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 KB'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = Math.floor(safeSeconds % 60)

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function CallTranscription({ currentUser, onLogout }) {
  const [audioFile, setAudioFile] = useState(null)
  const [language, setLanguage] = useState('auto')
  const [outputLanguage, setOutputLanguage] = useState('hi')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [isUploading, setIsUploading] = useState(false)
  const displayTranscript = result?.displayTranscript || result?.transcript || ''

  const transcriptLines = useMemo(() => {
    if (!result?.segments?.length) {
      return []
    }

    return result.segments.map((segment) => ({
      ...segment,
      timeLabel: `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
    }))
  }, [result])

  const scriptText = useMemo(() => {
    if (transcriptLines.length) {
      return transcriptLines
        .map((segment) => `${segment.speaker} (${segment.timeLabel})\n${segment.text}`)
        .join('\n\n')
    }

    return displayTranscript
  }, [displayTranscript, transcriptLines])

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null
    setAudioFile(file)
    setResult(null)
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!audioFile) {
      setMessageType('error')
      setMessage('Choose an audio call file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('language', language)
    formData.append('outputLanguage', outputLanguage)

    setIsUploading(true)
    setMessage('')
    setResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/transcription/upload`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Transcription failed.')
      }

      setResult(payload)
      setMessageType(payload.translationError ? 'error' : 'success')
      setMessage(payload.translationError || 'Transcription complete.')
    } catch (error) {
      setMessageType('error')
      setMessage(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  async function copyTranscript() {
    if (!scriptText) {
      return
    }

    try {
      await navigator.clipboard.writeText(scriptText)
      setMessageType('success')
      setMessage('Transcript copied.')
    } catch {
      setMessageType('error')
      setMessage('Clipboard is unavailable in this browser.')
    }
  }

  function downloadTranscript() {
    if (!scriptText) {
      return
    }

    const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${result.filename || 'call-transcript'}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">AI Call Center Evaluation</p>
          <h1>Call Transcription</h1>
        </div>
        <div className="user-panel" aria-label="Current user">
          <span>{currentUser.fullName}</span>
          <strong>{currentUser.employeeId}</strong>
          <button className="secondary-button" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="upload-layout" aria-label="Audio transcription workspace">
        <form className="upload-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>Upload Audio</h2>
            <span className="status-pill">{currentUser.role}</span>
          </div>

          <label className="drop-zone" htmlFor="audio-upload">
            <input
              id="audio-upload"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac"
              onChange={handleFileChange}
            />
            <span className="drop-zone-title">
              {audioFile ? audioFile.name : 'Select audio call'}
            </span>
            <span className="drop-zone-meta">
              {audioFile ? formatFileSize(audioFile.size) : 'MP3, WAV, M4A, MP4, WEBM, OGG, FLAC'}
            </span>
          </label>

          <label htmlFor="speech-language">Speech Language</label>
          <select
            id="speech-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="output-language">Script Output</label>
          <select
            id="output-language"
            value={outputLanguage}
            onChange={(event) => setOutputLanguage(event.target.value)}
          >
            {outputLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {message ? (
            <p className={`form-message ${messageType}`} role="status">
              {message}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={isUploading}>
            {isUploading ? 'Transcribing...' : 'Transcribe Call'}
          </button>
        </form>

        <section className="script-panel" aria-labelledby="script-title">
          <div className="panel-heading">
            <div>
              <h2 id="script-title">Script</h2>
              {result ? (
                <p className="result-meta">
                  {result.language?.toUpperCase()} to {result.outputLanguage?.toUpperCase()} /{' '}
                  {formatTime(result.duration)}
                </p>
              ) : null}
            </div>
            {scriptText ? (
              <div className="script-actions">
                <button className="secondary-button" type="button" onClick={copyTranscript}>
                  Copy
                </button>
                <button className="secondary-button" type="button" onClick={downloadTranscript}>
                  Download
                </button>
              </div>
            ) : null}
          </div>

          {displayTranscript ? (
            <div className="script-content">
              {transcriptLines.length ? (
                transcriptLines.map((segment) => (
                  <article className="script-line" key={segment.id}>
                    <div className="script-line-meta">
                      <span>{segment.speaker}</span>
                      <time>{segment.timeLabel}</time>
                    </div>
                    <p>{segment.text}</p>
                  </article>
                ))
              ) : (
                <p className="script-plain">{displayTranscript}</p>
              )}
            </div>
          ) : (
            <div className="empty-script">
              <h3>No script yet</h3>
              <p>Upload an audio call to generate the transcript.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default CallTranscription
