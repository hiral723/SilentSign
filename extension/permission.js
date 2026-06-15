const SIGN_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
const CONFIDENCE_THRESHOLD = 0.80
const SMOOTH_WINDOW = 8
const HOLD_FRAMES = 12

let model = null
let camera = null
let handsInstance = null
let predHistory = []
let holdCount = 0
let lastAccepted = null

const statusEl = document.getElementById('status')
const spinner  = document.getElementById('spinner')
const retryBtn = document.getElementById('retryBtn')
const video    = document.getElementById('video')
const canvas   = document.getElementById('canvas')
const ctx      = canvas.getContext('2d')

function sendToPopup(msg) {
  chrome.runtime.sendMessage({ ...msg, target: 'popup' }).catch(() => {})
}
function setStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = 'status' + (type ? ' ' + type : '')
}

function normalizeHand(landmarks) {
  const wrist = landmarks[0]
  const norm = landmarks.map(lm => ({
    x: lm.x - wrist.x, y: lm.y - wrist.y, z: lm.z - wrist.z
  }))
  const ref = norm[9]
  const scale = Math.sqrt(ref.x**2 + ref.y**2 + ref.z**2) || 1
  return norm.flatMap(lm => [lm.x/scale, lm.y/scale, lm.z/scale])
}

function normalizeLandmarks(multiHandLandmarks, multiHandedness) {
  if (!multiHandLandmarks?.length) return null
  const hands = {}
  multiHandLandmarks.forEach((lms, i) => {
    const label = multiHandedness?.[i]?.label ?? (i === 0 ? 'Right' : 'Left')
    hands[label] = normalizeHand(lms)
  })
  const zeros = new Array(63).fill(0)
  return [...(hands['Right'] ?? zeros), ...(hands['Left'] ?? zeros)]
}

function smoothPredict(rawIdx) {
  predHistory.push(rawIdx)
  if (predHistory.length > SMOOTH_WINDOW) predHistory.shift()
  const counts = {}
  for (const i of predHistory) counts[i] = (counts[i]||0) + 1
  return parseInt(Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0])
}

function runInference(features) {
  if (!model || typeof tf === 'undefined') return null
  const input = tf.tensor2d([features])
  const output = model.predict(input)
  const probs = Array.from(output.dataSync())
  input.dispose(); output.dispose()
  const maxIdx = probs.indexOf(Math.max(...probs))
  const conf = probs[maxIdx]
  if (conf < CONFIDENCE_THRESHOLD) return null
  const smoothed = smoothPredict(maxIdx)
  if (smoothed === maxIdx) holdCount++
  else holdCount = 0
  const label = SIGN_LABELS[smoothed] || `Sign_${smoothed}`
  if (holdCount >= HOLD_FRAMES && label !== lastAccepted) {
    lastAccepted = label; holdCount = 0
    return { label, conf, fresh: true }
  }
  return { label, conf, fresh: false }
}

async function startPipeline() {
  retryBtn.style.display = 'none'
  spinner.style.display = 'block'
  setStatus('Loading model…')
  sendToPopup({ type: 'STATUS', state: 'loading', text: 'Loading model…' })

  try {
    const modelURL = chrome.runtime.getURL('model/model.json')
    model = await tf.loadLayersModel(modelURL)

    setStatus('Starting camera…')
    sendToPopup({ type: 'STATUS', state: 'loading', text: 'Starting camera…' })

    handsInstance = new Hands({
      locateFile: f => chrome.runtime.getURL(`mediapipe/${f}`)
    })
    handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    })

    handsInstance.onResults(results => {
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(-1, 1)
      ctx.translate(-canvas.width, 0)
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      if (results.multiHandLandmarks?.length > 0) {
        results.multiHandLandmarks.forEach(lms => {
          const mirroredLms = lms.map(lm => ({ ...lm, x: 1 - lm.x }))
          drawConnectors(ctx, mirroredLms, HAND_CONNECTIONS, { color: 'rgba(62,207,142,0.8)', lineWidth: 2 })
          drawLandmarks(ctx, mirroredLms, { color: '#3ecf8e', fillColor: 'white', lineWidth: 1, radius: 3 })
        })

        const features = normalizeLandmarks(results.multiHandLandmarks, results.multiHandedness)
        if (features) {
          const result = runInference(features)
          if (result) {
            sendToPopup({ type: 'PREDICTION', label: result.label, conf: result.conf, fresh: result.fresh })
          }
        }
      } else {
        sendToPopup({ type: 'PREDICTION', label: null })
      }

      sendToPopup({ type: 'FRAME', dataURL: canvas.toDataURL('image/jpeg', 0.5) })
    })

    camera = new Camera(video, {
      onFrame: async () => { await handsInstance.send({ image: video }) },
      width: 320, height: 240,
    })
    await camera.start()

    spinner.style.display = 'none'
    setStatus('✓ Camera running — keep this tab open', 'success')
    sendToPopup({ type: 'STATUS', state: 'on' })

  } catch (err) {
    spinner.style.display = 'none'
    let msg = err.message
    if (err.name === 'NotAllowedError')  msg = 'Camera permission denied. Click Try Again and allow access.'
    if (err.name === 'NotFoundError')    msg = 'No camera found on this device.'
    if (err.name === 'NotReadableError') msg = 'Camera is in use by another app. Close it and try again.'
    setStatus('⚠ ' + msg, 'error')
    retryBtn.style.display = 'block'
    sendToPopup({ type: 'ERROR', message: msg })
  }
}

function stopPipeline() {
  camera?.stop()
  handsInstance?.close()
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop())
    video.srcObject = null
  }
  camera = null; handsInstance = null
}

retryBtn.addEventListener('click', startPipeline)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STOP_CAMERA' && msg.target === 'camera_tab') {
    stopPipeline(); window.close()
  }
})
window.addEventListener('load', startPipeline)