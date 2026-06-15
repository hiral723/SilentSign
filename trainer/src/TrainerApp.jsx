import { useState } from 'react'
import Collector from './Collector.jsx'
import Trainer from './Trainer.jsx'
import './TrainerApp.css'

const TABS = [
  { id: 'collect', label: 'Collect Data', desc: 'Record signs for training' },
  { id: 'train',   label: 'Train Model', desc: 'Build & export the model' },
]

export default function TrainerApp() {
  const [tab, setTab] = useState('collect')

  return (
    <div className="trainer-app">
      <header className="t-header">
        <div className="t-logo">
          <div className="t-logo-icon">◈</div>
          <div>
            <div className="t-logo-name">SilentSign <span className="t-badge">Dev Trainer</span></div>
            <div className="t-logo-sub">Collect data · Train model · Export to extension</div>
          </div>
        </div>
        <nav className="t-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`t-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="t-tab-sub">{t.desc}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="t-main">
        {tab === 'collect' && <Collector />}
        {tab === 'train'   && <Trainer />}
      </main>

      <footer className="t-footer">
        This tool is for developers only. After training, copy model files to <code>extension/model/</code> and load the extension in Chrome.
      </footer>
    </div>
  )
}
