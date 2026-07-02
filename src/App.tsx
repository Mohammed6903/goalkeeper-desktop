import { useState } from 'react'

export default function App() {
  const [isLight, setIsLight] = useState(false)

  function toggleTheme() {
    const next = !isLight
    setIsLight(next)
    if (next) {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* ── Title bar (draggable) ── */}
      <header
        data-drag
        className="flex h-[34px] shrink-0 items-center justify-center"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
          GoalKeeper
        </span>

        {/* Theme toggle — not draggable so the click registers */}
        <button
          data-no-drag
          onClick={toggleTheme}
          className="absolute right-3 flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}
          aria-label="Toggle light/dark theme"
        >
          {isLight ? '☀ Latte' : '☾ Mocha'}
        </button>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (220 px) */}
        <aside
          className="flex w-[220px] shrink-0 flex-col"
          style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
        >
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-dim)' }}>
            {/* Sidebar goes here (Task 7.1) */}
            Sidebar
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-auto" style={{ background: 'var(--bg)' }}>
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-dim)' }}>
            {/* Routed views (Task 7.4) */}
            Dashboard
          </div>
        </main>
      </div>
    </div>
  )
}
