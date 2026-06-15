let overlayEl = null
let overlayEnabled = false

function createOverlay() {
  if (overlayEl) return
  overlayEl = document.createElement('div')
  overlayEl.id = 'silentsign-overlay'
  overlayEl.innerHTML = `
    <div class="ss-inner">
      <div class="ss-badge">
        <span class="ss-dot"></span>
        SilentSign
      </div>
      <div class="ss-text" id="ss-text">Waiting for signs…</div>
    </div>
  `
  document.body.appendChild(overlayEl)
}

function removeOverlay() {
  overlayEl?.remove()
  overlayEl = null
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SILENTSIGN_OVERLAY') {
    overlayEnabled = msg.enabled
    if (overlayEnabled) createOverlay()
    else removeOverlay()
  }

  if (msg.type === 'SILENTSIGN_WORD' && overlayEl) {
    const el = document.getElementById('ss-text')
    if (el) {
      el.textContent = msg.sentence
      // flash animation
      el.style.color = '#27a96e'
      setTimeout(() => { el.style.color = '' }, 400)
    }
  }

  if (msg.type === 'SILENTSIGN_CLEAR' && overlayEl) {
    const el = document.getElementById('ss-text')
    if (el) el.textContent = 'Waiting for signs…'
  }
})
