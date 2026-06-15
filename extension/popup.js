const SIGN_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
const MAX_WORDS = 20

let isRunning = false
let words = []
let overlayEnabled = false

const $ = id => document.getElementById(id)
const toggleBtn     = $('toggleBtn')
const toggleLabel   = $('toggleLabel')
const toggleIcon    = $('toggleIcon')
const statusPill    = $('statusPill')
const statusDot     = $('statusDot')
const statusText    = $('statusText')
const cameraOff     = $('cameraOff')
const cameraLoading = $('cameraLoading')
const loadingText   = $('loadingText')
const previewCanvas = $('previewCanvas')
const predBadge     = $('predictionBadge')
const predSign      = $('predictionSign')
const predConf      = $('predictionConf')
const subtitleWords = $('subtitleWords')
const clearBtn      = $('clearBtn')
const overlayBtn    = $('overlayBtn')
const copyBtn       = $('copyBtn')
const signsGrid     = $('signsGrid')
const ctx           = previewCanvas.getContext('2d')

SIGN_LABELS.forEach(sign => {
  const chip = document.createElement('div')
  chip.className = 'sign-chip'
  chip.textContent = sign
  signsGrid.appendChild(chip)
})

function setStatus(state, text) {
  if (state === 'on') {
    statusPill.classList.add('active'); statusDot.classList.add('active')
    statusText.textContent = 'Active'
    toggleBtn.classList.add('active'); toggleBtn.disabled = false
    toggleLabel.textContent = 'Stop translating'
    toggleIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'
    cameraLoading.style.display = 'none'
    cameraOff.style.display = 'none'
    previewCanvas.style.display = 'block'
    previewCanvas.classList.add('visible')
    isRunning = true
  } else if (state === 'loading') {
    statusPill.classList.remove('active'); statusDot.classList.remove('active')
    statusText.textContent = 'Loading…'; toggleBtn.disabled = true
    cameraOff.style.display = 'none'
    cameraLoading.style.display = 'flex'
    loadingText.textContent = text || 'Loading…'
    isRunning = false
  } else {
    statusPill.classList.remove('active'); statusDot.classList.remove('active')
    statusText.textContent = 'Off'
    toggleBtn.classList.remove('active'); toggleBtn.disabled = false
    toggleLabel.textContent = 'Start translating'
    toggleIcon.innerHTML = '<polygon points="5,3 19,12 5,21" fill="currentColor"/>'
    cameraLoading.style.display = 'none'
    previewCanvas.style.display = 'none'
    previewCanvas.classList.remove('visible')
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
    cameraOff.style.display = 'flex'
    predBadge.style.display = 'none'
    isRunning = false
  }
}

function renderSubtitles(newWord) {
  subtitleWords.innerHTML = ''
  if (!words.length) {
    subtitleWords.innerHTML = '<span class="subtitle-empty">Your translation will appear here…</span>'
    return
  }
  words.forEach((w, i) => {
    const span = document.createElement('span')
    span.className = 'subtitle-word' + (i === words.length-1 && w === newWord ? ' new' : '')
    span.textContent = w
    subtitleWords.appendChild(span)
  })
}

function addWord(label) {
  words.push(label)
  if (words.length > MAX_WORDS) words.shift()
  renderSubtitles(label)
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SILENTSIGN_WORD', word: label, sentence: words.join(' ')
    }).catch(() => {})
  })
}

chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (chrome.runtime.lastError) return
  if (response?.state === 'on') setStatus('on')
  else if (response?.state === 'loading') setStatus('loading', 'Loading…')
  else setStatus('off')
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'popup') return

  if (msg.type === 'STATUS') setStatus(msg.state, msg.text)

  if (msg.type === 'ERROR') {
    setStatus('off')
    cameraOff.querySelector('p').textContent = '⚠ ' + msg.message
  }

  if (msg.type === 'FRAME') {
    previewCanvas.style.display = 'block'
    previewCanvas.classList.add('visible')
    cameraOff.style.display = 'none'
    cameraLoading.style.display = 'none'

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
      ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height)
    }
    img.src = msg.dataURL
  }

  if (msg.type === 'PREDICTION') {
    if (msg.label) {
      predBadge.style.display = 'flex'
      predSign.textContent = msg.label
      predConf.textContent = `${(msg.conf * 100).toFixed(0)}%`
      if (msg.fresh) addWord(msg.label)
    } else {
      predBadge.style.display = 'none'
    }
  }
})

toggleBtn.addEventListener('click', () => {
  if (isRunning) {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_CAMERA' })
    setStatus('off')
    cameraOff.querySelector('p').textContent = 'Enable to start translating'
  } else {
    setStatus('loading', 'Opening camera…')
    chrome.runtime.sendMessage({ type: 'REQUEST_CAMERA_PERMISSION' })
  }
})

clearBtn.addEventListener('click', () => {
  words = []; renderSubtitles(null)
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'SILENTSIGN_CLEAR' }).catch(() => {})
  })
})

copyBtn.addEventListener('click', () => {
  if (!words.length) return
  navigator.clipboard.writeText(words.join(' '))
  copyBtn.textContent = '✓ Copied!'
  setTimeout(() => {
    copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.8"/></svg> Copy`
  }, 1500)
})

overlayBtn.addEventListener('click', () => {
  overlayEnabled = !overlayEnabled
  overlayBtn.classList.toggle('active', overlayEnabled)
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SILENTSIGN_OVERLAY', enabled: overlayEnabled
    }).catch(() => {})
  })
})