import { useState, useCallback, useRef } from 'react'
import { useMediaPipe } from './useMediaPipe.js'
import { SIGN_LABELS, SAMPLES_TARGET } from './config.js'
import './Collector.css'

export default function Collector() {
  const [isRunning, setIsRunning] = useState(false)
  const [selected, setSelected] = useState(SIGN_LABELS[0])
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [dataset, setDataset] = useState({})
  const recordingRef = useRef(false)
  const timerRef = useRef(null)

  const handleLandmarks = useCallback((features) => {
    if (!recordingRef.current || !features) return
    setDataset(prev => ({
      ...prev,
      [selected]: [...(prev[selected] || []), features]
    }))
  }, [selected])

  const { videoRef, canvasRef, status, error, start, stop } = useMediaPipe({ onLandmarks: handleLandmarks })

  const handleCameraToggle = async () => {
    if (isRunning) { stop(); setIsRunning(false); stopRecording() }
    else { await start(); setIsRunning(true) }
  }

  const startRecording = () => {
    let c = 3
    setCountdown(c)
    timerRef.current = setInterval(() => {
      c--
      if (c <= 0) {
        clearInterval(timerRef.current)
        setCountdown(null)
        setIsRecording(true)
        recordingRef.current = true
        timerRef.current = setTimeout(() => stopRecording(), 8000)
      } else {
        setCountdown(c)
      }
    }, 1000)
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    clearTimeout(timerRef.current)
    setIsRecording(false)
    setCountdown(null)
    recordingRef.current = false
  }

  const handleRecord = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const handleExport = () => {
    const header = Array.from({length:63},(_,i)=>`f${i}`).join(',') + ',label'
    const rows = [header]
    for (const [label, samples] of Object.entries(dataset)) {
      for (const s of samples) rows.push([...s, label].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'silentsign_dataset.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalSamples = Object.values(dataset).reduce((s,a) => s + a.length, 0)
  const currentCount = (dataset[selected] || []).length
  const readyToTrain = totalSamples >= 200 && Object.keys(dataset).length >= 2

  return (
    <div className="collector">
      <div className="c-left">
        <div className="cam-card">
          {}
          <video
            ref={videoRef}
            style={{ display: 'none' }}
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="cam-canvas" width={640} height={480} />

          {!isRunning && (
            <div className="cam-empty">
              <div className="cam-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M23 7l-7 5 7 5V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <span>Start camera to begin</span>
            </div>
          )}

          {countdown !== null && (
            <div className="countdown-overlay">
              <span className="countdown-num">{countdown}</span>
              <span className="countdown-label">Get ready to sign "{selected}"</span>
            </div>
          )}

          {isRecording && (
            <div className="rec-badge">
              <span className="rec-dot" /> Recording · {selected}
            </div>
          )}

          <div className="cam-footer">
            <div className="cam-status">
              <span className={`sdot ${status === 'ready' ? 'on' : ''}`} />
              {status === 'loading' ? 'Loading MediaPipe…' : status}
            </div>
            <span className="cam-count">
              {currentCount} / {SAMPLES_TARGET}
            </span>
          </div>
        </div>

        <div className="c-cam-btns">
          <button className={`btn-cam ${isRunning ? 'stop' : 'start'}`} onClick={handleCameraToggle}>
            {isRunning ? '■  Stop camera' : '▶  Start camera'}
          </button>
          <button
            className={`btn-rec ${isRecording ? 'recording' : ''}`}
            onClick={handleRecord}
            disabled={!isRunning || status !== 'ready'}
          >
            {isRecording ? '■  Stop' : `●  Record`}
          </button>
        </div>

        {error && <div className="c-error">⚠ {error}</div>}

        <div className="c-tips">
          <div className="c-tips-title">Tips for quality data</div>
          <ul>
            <li>Record 3–4 bursts per sign, repositioning slightly between each</li>
            <li>Vary hand distance: close, medium, arm-length</li>
            <li>Try different lighting — bright, dim, side-lit</li>
            <li>Have a second person contribute samples if possible</li>
          </ul>
        </div>
      </div>

      <div className="c-right">
        <div className="c-section-label">Select sign to record</div>
        <div className="sign-grid">
          {SIGN_LABELS.map(sign => {
            const count = (dataset[sign] || []).length
            const pct = Math.min(count / SAMPLES_TARGET, 1)
            const done = pct >= 1
            return (
              <button
                key={sign}
                className={`sign-btn ${selected === sign ? 'selected' : ''} ${done ? 'done' : ''}`}
                onClick={() => setSelected(sign)}
              >
                <span className="sb-name">{sign}</span>
                <span className="sb-count">{count}</span>
                <div className="sb-bar" style={{width:`${pct*100}%`}} />
              </button>
            )
          })}
        </div>

        <div className="c-stats">
          <div className="c-stat">
            <span className="c-stat-val">{totalSamples}</span>
            <span className="c-stat-label">total samples</span>
          </div>
          <div className="c-stat">
            <span className="c-stat-val">{Object.keys(dataset).length}</span>
            <span className="c-stat-label">signs recorded</span>
          </div>
          <div className="c-stat">
            <span className={`c-stat-val ${readyToTrain ? 'green' : 'muted'}`}>
              {readyToTrain ? '✓ Ready' : `${Math.max(0, 200-totalSamples)} more`}
            </span>
            <span className="c-stat-label">to train</span>
          </div>
        </div>

        <button className="btn-export" onClick={handleExport} disabled={totalSamples === 0}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export dataset CSV
        </button>
      </div>
    </div>
  )
}