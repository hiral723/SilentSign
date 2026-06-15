import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sizes = [16, 48, 128]

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  const r = size * 0.14  // corner radius
  const pad = size * 0.06

  // Background rounded rect
  ctx.beginPath()
  ctx.moveTo(pad + r, pad)
  ctx.lineTo(size - pad - r, pad)
  ctx.quadraticCurveTo(size - pad, pad, size - pad, pad + r)
  ctx.lineTo(size - pad, size - pad - r)
  ctx.quadraticCurveTo(size - pad, size - pad, size - pad - r, size - pad)
  ctx.lineTo(pad + r, size - pad)
  ctx.quadraticCurveTo(pad, size - pad, pad, size - pad - r)
  ctx.lineTo(pad, pad + r)
  ctx.quadraticCurveTo(pad, pad, pad + r, pad)
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#3ecf8e')
  grad.addColorStop(1, '#27a96e')
  ctx.fillStyle = grad
  ctx.fill()

  // Hand icon - simplified
  ctx.strokeStyle = 'white'
  ctx.lineWidth = size * 0.09
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const cx = size / 2
  const cy = size / 2

  if (size >= 48) {
    // Draw a simplified hand outline
    const s = size * 0.28
    // Palm base
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.5, cy + s * 0.4)
    ctx.lineTo(cx - s * 0.5, cy - s * 0.1)
    ctx.lineTo(cx + s * 0.5, cy - s * 0.1)
    ctx.lineTo(cx + s * 0.5, cy + s * 0.4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()
    ctx.stroke()

    // Fingers
    const fingerW = s * 0.18
    const tops = [-s*0.5, -s*0.15, s*0.15, s*0.5]
    tops.forEach((x, i) => {
      const h = i === 1 || i === 2 ? s * 0.55 : s * 0.4
      ctx.beginPath()
      ctx.moveTo(cx + x, cy - s * 0.1)
      ctx.lineTo(cx + x, cy - s * 0.1 - h)
      ctx.stroke()
    })
  } else {
    // Simple checkmark for 16px
    ctx.beginPath()
    ctx.moveTo(size * 0.25, size * 0.5)
    ctx.lineTo(size * 0.45, size * 0.7)
    ctx.lineTo(size * 0.75, size * 0.3)
    ctx.stroke()
  }

  return canvas.toBuffer('image/png')
}

mkdirSync(resolve(__dirname, 'extension/icons'), { recursive: true })

sizes.forEach(size => {
  const buf = drawIcon(size)
  const out = resolve(__dirname, `extension/icons/icon${size}.png`)
  writeFileSync(out, buf)
  console.log(`✓ icon${size}.png`)
})

console.log('All icons generated.')
