import { useEffect, useRef, useState, useCallback } from 'react'

function normalizeHand(landmarks) {
  const wrist = landmarks[0]
  const norm = landmarks.map(lm => ({
    x: lm.x - wrist.x,
    y: lm.y - wrist.y,
    z: lm.z - wrist.z,
  }))
  const ref = norm[9]
  const scale = Math.sqrt(ref.x**2 + ref.y**2 + ref.z**2) || 1
  return norm.flatMap(lm => [lm.x/scale, lm.y/scale, lm.z/scale])
}

export function normalizeLandmarks(multiHandLandmarks, multiHandedness) {
  if (!multiHandLandmarks?.length) return null
  const hands = {}
  multiHandLandmarks.forEach((lms, i) => {
    const label = multiHandedness?.[i]?.label ?? (i === 0 ? 'Right' : 'Left')
    hands[label] = normalizeHand(lms)
  })
  const zeros = new Array(63).fill(0)
  return [...(hands['Right'] ?? zeros), ...(hands['Left'] ?? zeros)]
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.crossOrigin = 'anonymous'
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

const CDN = 'https://cdn.jsdelivr.net/npm'
const HANDS_VER   = '@mediapipe/hands@0.4.1675469240'
const CAMERA_VER  = '@mediapipe/camera_utils@0.3.1675466862'
const DRAWING_VER = '@mediapipe/drawing_utils@0.3.1675466124'

async function loadMediaPipe() {
  await loadScript(`${CDN}/${HANDS_VER}/hands.js`)
  await loadScript(`${CDN}/${CAMERA_VER}/camera_utils.js`)
  await loadScript(`${CDN}/${DRAWING_VER}/drawing_utils.js`)
  const Hands = window.Hands
  const Camera = window.Camera
  const drawConnectors = window.drawConnectors
  const drawLandmarks = window.drawLandmarks
  const HAND_CONNECTIONS = window.HAND_CONNECTIONS
  if (!Hands || typeof Hands !== 'function') {
    throw new Error('MediaPipe Hands failed to load — check your internet connection')
  }
  return { Hands, Camera, drawConnectors, drawLandmarks, HAND_CONNECTIONS }
}

export function useMediaPipe({ onLandmarks } = {}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const handsRef = useRef(null)
  const cameraRef = useRef(null)
  const onLandmarksRef = useRef(onLandmarks)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => { onLandmarksRef.current = onLandmarks }, [onLandmarks])

  const start = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (cameraRef.current) return
    setStatus('loading')
    setError(null)

    try {
      const video = videoRef.current
      video.setAttribute('autoplay', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('muted', '')
      video.muted = true

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      video.srcObject = stream
      await video.play().catch(() => {})

      const { Hands, Camera, drawConnectors, drawLandmarks, HAND_CONNECTIONS } =
        await loadMediaPipe()

      const hands = new Hands({
        locateFile: f => `${CDN}/${HANDS_VER}/${f}`
      })
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6,
      })

      hands.onResults(results => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        if (results.multiHandLandmarks?.length > 0) {
          results.multiHandLandmarks.forEach(lms => {
            drawConnectors(ctx, lms, HAND_CONNECTIONS, { color: 'rgba(62,207,142,0.7)', lineWidth: 2 })
            drawLandmarks(ctx, lms, { color: '#3ecf8e', fillColor: 'white', lineWidth: 1, radius: 4 })
          })
          const features = normalizeLandmarks(results.multiHandLandmarks, results.multiHandedness)
          onLandmarksRef.current?.(features, results.multiHandLandmarks)
        } else {
          onLandmarksRef.current?.(null, null)
        }
      })

      handsRef.current = hands
      stream.getTracks().forEach(t => t.stop())
      video.srcObject = null

      const camera = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }) },
        width: 640, height: 480,
      })
      await camera.start()
      cameraRef.current = camera
      setStatus('ready')

    } catch (err) {
      let msg = err.message
      if (err.name === 'NotAllowedError')  msg = 'Camera permission denied. Please allow camera access and try again.'
      if (err.name === 'NotFoundError')    msg = 'No camera found. Please connect a camera and try again.'
      if (err.name === 'NotReadableError') msg = 'Camera is already in use by another application.'
      setError(msg)
      setStatus('error')
    }
  }, [])

  const stop = useCallback(() => {
    cameraRef.current?.stop()
    handsRef.current?.close()
    const video = videoRef.current
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    cameraRef.current = null
    handsRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, canvasRef, status, error, start, stop }
}