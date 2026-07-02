/**
 * NowPanel — "What should I do right now?" LLM advisor.
 *
 * Inputs: timeAvailable (minutes) + energy (low/medium/high).
 * Calls window.gk.runNow() → WhatNowResult.
 * Renders: summary + ranked shortlist with Start / Dismiss per item.
 */

import { useState } from 'react'
import { Zap, RefreshCw, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { WhatNowResult } from '@core/llm/schemas'
import { useStartTask, useReady } from '../../hooks/useGk'
import { useNav } from '../../lib/nav'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNoKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NoApiKey') || msg.toLowerCase().includes('api key')
}

function labelEnergy(e: string) {
  return e.charAt(0).toUpperCase() + e.slice(1)
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  gap: 0,
}

const headerStyle: React.CSSProperties = {
  padding: '16px 20px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 14px',
  borderRadius: 7,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 13,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

// ---------------------------------------------------------------------------
// NowPanel
// ---------------------------------------------------------------------------

export function NowPanel() {
  const { go } = useNav()
  const { data: readyTasks = [] } = useReady()
  const startTask = useStartTask()

  const [minutes, setMinutes] = useState<number>(30)
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high'>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)
  const [result, setResult] = useState<WhatNowResult | null>(null)
  // local dismissed refs
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  async function run() {
    setLoading(true)
    setError(null)
    setNoKey(false)
    setResult(null)
    setDismissed(new Set())
    try {
      const r = await window.gk.runNow({ timeAvailable: minutes, energy })
      setResult(r)
    } catch (err) {
      if (isNoKeyError(err)) {
        setNoKey(true)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setLoading(false)
    }
  }

  function dismiss(ref: string) {
    setDismissed((prev) => new Set([...prev, ref]))
  }

  function handleStart(ref: string) {
    const seq = Number(ref)
    startTask.mutate(seq, {
      onSuccess: (task) => {
        const title = task?.title ?? `#${ref}`
        toast.success(`Started: ${title}`)
        dismiss(ref)
      },
      onError: (err) => {
        toast.error(`Failed to start task: ${err.message}`)
      },
    })
  }

  // Resolve seq → task title
  function resolveTitle(ref: string): string {
    const seq = Number(ref)
    const t = readyTasks.find((t) => t.seq === seq)
    return t ? t.title : `Task #${ref}`
  }

  const visibleItems = result?.shortlist.filter((p) => !dismissed.has(p.ref)) ?? []

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="var(--ctp-yellow)" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            What now?
          </h2>
        </div>

        {/* Controls */}
        <div style={inputRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>
              Minutes
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              style={{ ...inputStyle, width: 70 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>
              Energy
            </label>
            <select
              value={energy}
              onChange={(e) => setEnergy(e.target.value as 'low' | 'medium' | 'high')}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <button
            onClick={run}
            disabled={loading}
            style={{ ...btnPrimaryStyle, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            <Zap size={13} />
            {loading ? 'Thinking…' : 'Ask'}
          </button>

          {result && !loading && (
            <button onClick={run} style={btnGhostStyle}>
              <RefreshCw size={13} />
              Re-ask
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* No API key state */}
        {noKey && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '40px 20px',
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            <Settings size={32} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Gemini API key required</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
              Add your Gemini API key in{' '}
              <button
                onClick={() => go({ kind: 'settings' })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Settings
              </button>{' '}
              to use AI features.
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--ctp-red) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ctp-red) 30%, transparent)',
              color: 'var(--ctp-red)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
            Consulting Gemini for {minutes}m · {labelEnergy(energy)} energy…
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {result.summary && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--ctp-blue) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--ctp-blue) 20%, transparent)',
                  fontSize: 13,
                  color: 'var(--text)',
                  lineHeight: 1.5,
                }}
              >
                {result.summary}
              </div>
            )}

            {visibleItems.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                No suggestions — all dismissed or list empty.
              </div>
            )}

            {visibleItems.map((pick, i) => (
              <div key={pick.ref} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                      borderRadius: 99,
                      padding: '2px 8px',
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    task #{pick.ref}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {resolveTitle(pick.ref)}
                </p>

                {pick.reason && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {pick.reason}
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => handleStart(pick.ref)}
                    disabled={startTask.isPending}
                    style={{
                      ...btnPrimaryStyle,
                      fontSize: 12,
                      padding: '5px 12px',
                      opacity: startTask.isPending ? 0.7 : 1,
                      cursor: startTask.isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => dismiss(pick.ref)}
                    style={{ ...btnGhostStyle, fontSize: 12, padding: '5px 12px' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty — no result yet, no error */}
        {!result && !loading && !error && !noKey && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 8,
              color: 'var(--text-dim)',
              textAlign: 'center',
              padding: '40px 0',
            }}
          >
            <Zap size={32} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Set your time and energy level, then click <strong>Ask</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
