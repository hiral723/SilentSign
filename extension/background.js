let cameraTabId = null
let currentState = 'off'

function sendToPopup(msg) {
  chrome.runtime.sendMessage({ ...msg, target: 'popup' }).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Popup opened and wants to restore its state
  if (msg.type === 'GET_STATE') {
    sendResponse({ state: currentState, tabId: cameraTabId })
    return true
  }

  // Popup: start
  if (msg.type === 'REQUEST_CAMERA_PERMISSION') {
    if (cameraTabId !== null) {
      // Already running — just restore popup state
      sendToPopup({ type: 'STATUS', state: currentState })
      return
    }
    currentState = 'loading'
    chrome.tabs.create({
      url: chrome.runtime.getURL('permission.html'),
      active: true
    }, tab => { cameraTabId = tab.id })
    return
  }

  // Popup: stop
  if (msg.type === 'STOP_CAMERA' && msg.target === 'offscreen') {
    if (cameraTabId !== null) {
      chrome.tabs.sendMessage(cameraTabId, { type: 'STOP_CAMERA', target: 'camera_tab' }).catch(() => {})
      chrome.tabs.remove(cameraTabId).catch(() => {})
      cameraTabId = null
    }
    currentState = 'off'
    return
  }

  // Camera tab → popup relay
  if (msg.target === 'popup') {
    if (msg.type === 'STATUS') currentState = msg.state
    if (msg.type === 'ERROR')  currentState = 'off'
    sendToPopup(msg)
    return
  }

  if (msg.type === 'SILENTSIGN_WORD' || msg.type === 'SILENTSIGN_CLEAR' || msg.type === 'SILENTSIGN_OVERLAY') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {})
    })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === cameraTabId) {
    cameraTabId = null
    currentState = 'off'
    sendToPopup({ type: 'ERROR', message: 'Camera tab was closed. Click Start to begin again.' })
  }
})