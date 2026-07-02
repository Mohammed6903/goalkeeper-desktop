/**
 * TitleBar — frameless-window custom title bar.
 *
 * ~34 px tall draggable region. Left: app mark. Right (no-drag): theme
 * toggle + window controls (minimize / maximize / close).
 */

import { useState } from 'react'
import { Sun, Moon, Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.classList.contains('light'),
  )

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
    <header
      data-drag
      className="flex h-[34px] shrink-0 items-center px-3"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* App mark — left */}
      <span
        className="select-none text-sm font-semibold tracking-wide"
        style={{ color: 'var(--ctp-mauve)' }}
      >
        ◈ GoalKeeper
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls — right, not draggable */}
      <div data-no-drag className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-6 w-6 items-center justify-center rounded text-xs transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-dim)' }}
          aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
          title={isLight ? 'Switch to dark (Mocha)' : 'Switch to light (Latte)'}
        >
          {isLight ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        {/* Minimize */}
        <button
          onClick={() => window.gk.minimizeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Minimize window"
        >
          <Minus size={13} />
        </button>

        {/* Maximize / restore */}
        <button
          onClick={() => window.gk.maximizeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Maximize window"
        >
          <Square size={12} />
        </button>

        {/* Close */}
        <button
          onClick={() => window.gk.closeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--ctp-red)]"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Close window"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  )
}
