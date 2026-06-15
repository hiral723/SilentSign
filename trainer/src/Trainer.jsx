import { useState, useRef, useCallback } from 'react'
import { SIGN_LABELS } from './config.js'
import './Trainer.css'

export default function Trainer() {
  const [csvStats, setCsvStats] = useState(null)
  const [csvData, setCsvData] = useState(null)
  const [training, setTraining] = useState(false)
  const [log, setLog] = useState([])
  const [done, setDone] = useState(false)
  const [accuracy, setAccuracy] = useState(null)
  const logRef = useRef(null)

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: Date.now() }])
    setTimeout(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight) }, 50)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split('\n')
      const header = lines[0]
        .split(',')
        .map(h => h.trim().toLowerCase())

      let labelCol = header.indexOf('label')

      if (labelCol === -1) {
        labelCol = header.length - 1
      }

      const rows = lines.slice(1).map(line =>
        line.split(',').map(cell => cell.trim())
      )
      const counts = {}
      for (const row of rows) {
        const lbl = (row[labelCol] || '').trim().toUpperCase()
        if (!lbl) continue
        counts[lbl] = (counts[lbl] || 0) + 1
        row[labelCol] = lbl
      }
      setCsvData({ rows, labelCol })
      setCsvStats({ total: rows.length, counts, features: labelCol })
      setLog([])
      setDone(false)
      addLog(`Loaded ${rows.length} samples across ${Object.keys(counts).length} signs`, 'success')
    }
    reader.readAsText(file)
  }

  const handleTrain = useCallback(async () => {
    if (!csvData) return
    setTraining(true); setDone(false); setLog([])

    try {
      const tf = await import('@tensorflow/tfjs')
      window._tf = tf

      const labels = Object.keys(csvStats.counts)
      const labelIdx = {}
      labels.forEach((l, i) => { labelIdx[l] = i })
      const N = labels.length

      addLog(`Classes (${N}): ${labels.join(', ')}`)

      const { rows, labelCol } = csvData
      const X = rows.map(r => r.slice(0, labelCol).map(Number))
      const Y = rows.map(r => {
        const oh = new Array(N).fill(0)
        const lbl = (r[labelCol] || '').trim().toUpperCase()
        if (labelIdx[lbl] !== undefined) {
          oh[labelIdx[lbl]] = 1
        }
        return oh
      })

      for (let i = X.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [X[i], X[j]] = [X[j], X[i]];
        [Y[i], Y[j]] = [Y[j], Y[i]]
      }

      const split = Math.floor(X.length * 0.8)
      const xTr = tf.tensor2d(X.slice(0, split))
      const yTr = tf.tensor2d(Y.slice(0, split))
      const xVl = tf.tensor2d(X.slice(split))
      const yVl = tf.tensor2d(Y.slice(split))

      addLog(`Train: ${split} · Val: ${X.length - split}`)
      addLog('Building network: 126 → 256 → 128 → 64 → ' + N)

      const model = tf.sequential()
      model.add(tf.layers.dense({ inputShape: [126], units: 256, activation: 'relu' }))
      model.add(tf.layers.batchNormalization())
      model.add(tf.layers.dropout({ rate: 0.3 }))
      model.add(tf.layers.dense({ units: 128, activation: 'relu' }))
      model.add(tf.layers.batchNormalization())
      model.add(tf.layers.dropout({ rate: 0.2 }))
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }))
      model.add(tf.layers.dense({ units: N, activation: 'softmax' }))

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      })

      addLog('Training for 60 epochs…')

      await model.fit(xTr, yTr, {
        epochs: 60,
        batchSize: 32,
        validationData: [xVl, yVl],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if ((epoch+1) % 15 === 0 || epoch === 0) {
              addLog(`Epoch ${epoch+1}/60 — loss: ${logs.loss.toFixed(3)} | val_acc: ${(logs.val_acc*100).toFixed(1)}%`)
            }
          }
        }
      })

      const res = model.evaluate(xVl, yVl)
      const acc = (await res[1].data())[0]
      setAccuracy(acc)
      addLog(`Final validation accuracy: ${(acc*100).toFixed(1)}%`, 'success')

      await model.save('downloads://silentsign_model')
      addLog('model.json + model.weights.bin downloaded', 'success')

      const lmap = JSON.stringify({ labels, labelIndex: labelIdx }, null, 2)
      const blob = new Blob([lmap], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'labels.json'; a.click()
      URL.revokeObjectURL(url)
      addLog('labels.json downloaded', 'success')

      xTr.dispose(); yTr.dispose(); xVl.dispose(); yVl.dispose()
      setDone(true)
    } catch (err) {
      addLog('Error: ' + err.message, 'error')
      console.error(err)
    } finally {
      setTraining(false)
    }
  }, [csvData, csvStats])

  return (
    <div className="trainer-wrap">
      <div className="tr-left">

        {/* Step 1 */}
        <div className="tr-step-card">
          <div className="tr-step-num">1</div>
          <div className="tr-step-body">
            <div className="tr-step-title">Upload your dataset</div>
            <div className="tr-step-desc">Export from the Collect tab first</div>
            <label className="upload-zone">
              <input type="file" accept=".csv" onChange={handleFile} />
              <div className="upload-inner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>{csvStats ? `✓ ${csvStats.total} samples loaded` : 'Click to upload silentsign_dataset.csv'}</span>
              </div>
            </label>

            {csvStats && (
              <div className="csv-breakdown">
                {Object.entries(csvStats.counts).map(([sign, count]) => (
                  <div key={sign} className="csv-row">
                    <span className="csv-sign">{sign}</span>
                    <div className="csv-bar-track">
                      <div className="csv-bar-fill" style={{width: `${Math.min(count/120*100,100)}%`}} />
                    </div>
                    <span className="csv-count">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div className="tr-step-card">
          <div className="tr-step-num">2</div>
          <div className="tr-step-body">
            <div className="tr-step-title">Train the model</div>
            <div className="tr-step-desc">Runs entirely in your browser · ~2 min</div>
            <button className="btn-train" onClick={handleTrain} disabled={!csvData || training}>
              {training
                ? <><span className="spinner" /> Training…</>
                : '▶  Train neural network'}
            </button>
            {done && accuracy && (
              <div className="accuracy-pill">
                <span className="acc-num">{(accuracy*100).toFixed(1)}%</span>
                <span className="acc-label">validation accuracy</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3 */}
        {done && (
          <div className="tr-step-card highlight">
            <div className="tr-step-num done">3</div>
            <div className="tr-step-body">
              <div className="tr-step-title">Copy files to extension</div>
              <div className="setup-steps">
                <div className="setup-step">
                  <span className="ss-bullet">→</span>
                  <span>Rename <code>silentsign_model.json</code> → <code>model.json</code></span>
                </div>
                <div className="setup-step">
                  <span className="ss-bullet">→</span>
                  <span>Copy <code>model.json</code> + <code>silentsign_model.weights.bin</code> to <code>extension/model/</code></span>
                </div>
                <div className="setup-step">
                  <span className="ss-bullet">→</span>
                  <span>Open <code>extension/popup.js</code> and update <code>SIGN_LABELS</code> to match <code>labels.json</code> order</span>
                </div>
                <div className="setup-step">
                  <span className="ss-bullet">→</span>
                  <span>Load the extension in Chrome and test the Translate tab</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tr-right">
        <div className="tr-section-label">Training log</div>
        <div className="log-panel" ref={logRef}>
          {log.length === 0
            ? <span className="log-empty">Logs will appear here during training…</span>
            : log.map((l, i) => (
              <div key={i} className={`log-line ${l.type}`}>
                <span className="log-prefix">›</span>
                <span>{l.msg}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}