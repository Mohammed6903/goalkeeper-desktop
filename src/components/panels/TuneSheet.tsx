/**
 * TuneSheet — LLM urgency-coefficient tuner, shown as a Radix Dialog.
 *
 * Calls window.gk.runTune() → TuneResult.
 * Each delta shows: coefficient name, current value, proposed value, reason.
 * Accept → immediately update that urgency coefficient in the persisted config.
 * Reject → remove from local list.
 */

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle, XCircle, TrendingUp, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import type { DraftCoeffDelta, TuneResult } from '@core/llm/schemas'
import { useConfig, useSaveConfig } from '../../hooks/useGk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNoKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NoApiKey') || msg.toLowerCase().includes('api key')
}

function num(s: string): number | null {
  const trimmed = String(s).trim()
  if (trimmed === '') return null
  const v = parseFloat(trimmed)
  return isNaN(v) ? null : v
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 1000,
}

const contentStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '520px',
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 24,
  boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: 7,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// TuneSheet
// ---------------------------------------------------------------------------

export function TuneSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: config } = useConfig()
  const saveConfig = useSaveConfig()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)
  const [result, setResult] = useState<TuneResult | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [accepted, setAccepted] = useState<Set<number>>(new Set())

  async function run() {
    setLoading(true)
    setError(null)
    setNoKey(false)
    setResult(null)
    setHidden(new Set())
    setAccepted(new Set())
    try {
      const r = await window.gk.runTune()
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

  async function acceptDelta(idx: number, delta: DraftCoeffDelta) {
    if (!config) {
      toast.error('Config not loaded yet')
      return
    }
    const parsed = num(delta.new_value)
    if (parsed === null) {
      toast.error(`Invalid value for ${delta.name}: "${delta.new_value}"`)
      return
    }
    const updated = {
      ...config,
      urgency: {
        ...config.urgency,
        [delta.name]: parsed,
      },
    }
    try {
      await saveConfig.mutateAsync(updated)
      toast.success(`Updated ${delta.name} → ${parsed}`)
      setAccepted((prev) => new Set([...prev, idx]))
      setHidden((prev) => new Set([...prev, idx]))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  function rejectDelta(idx: number) {
    setHidden((prev) => new Set([...prev, idx]))
  }

  const visibleDeltas = result?.deltas
    .map((d, idx) => ({ d, idx }))
    .filter(({ idx }) => !hidden.has(idx)) ?? []

  // Current value lookup from config (may be undefined for unknown keys)
  function currentVal(name: string): number | undefined {
    if (!config) return undefined
    const v = (config.urgency as unknown as Record<string, unknown>)[name]
    return typeof v === 'number' ? v : undefined
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle} aria-describedby={undefined}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--ctp-peach)" />
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                flex: 1,
              }}
            >
              Tune urgency weights
            </Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ ...btnGhostStyle, padding: '4px 8px' }}>
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Run button row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={run}
              disabled={loading}
              style={{
                ...btnPrimaryStyle,
                fontSize: 13,
                padding: '7px 16px',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <TrendingUp size={13} />
              {loading ? 'Analysing…' : 'Run tune'}
            </button>
            {result && !loading && (
              <button onClick={run} style={btnGhostStyle}>
                <RefreshCw size={13} />
                Re-run
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
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

          {/* No API key */}
          {noKey && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
              Add a Gemini API key in Settings to use AI features.
            </p>
          )}

          {/* Loading */}
          {loading && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>
              Analysing urgency patterns…
            </p>
          )}

          {/* Summary */}
          {result && !loading && result.summary && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--ctp-peach) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--ctp-peach) 20%, transparent)',
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              {result.summary}
            </div>
          )}

          {/* Delta list */}
          {result && !loading && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {result.deltas.length} coefficient{result.deltas.length !== 1 ? 's' : ''} proposed
                {accepted.size > 0 && (
                  <span style={{ color: 'var(--ctp-green)', marginLeft: 6 }}>
                    · {accepted.size} applied
                  </span>
                )}
              </div>

              {visibleDeltas.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
                  {result.deltas.length === 0
                    ? 'Weights look good — no adjustments suggested.'
                    : 'All proposals handled.'}
                </p>
              )}

              {visibleDeltas.map(({ d, idx }) => {
                const current = currentVal(d.name)
                const proposed = num(d.new_value)
                const direction =
                  current !== undefined && proposed !== null
                    ? proposed > current ? 'up' : proposed < current ? 'down' : 'same'
                    : null

                return (
                  <div key={idx} style={cardStyle}>
                    {/* Coefficient name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--ctp-peach)',
                          background: 'color-mix(in srgb, var(--ctp-peach) 12%, transparent)',
                          borderRadius: 4,
                          padding: '2px 7px',
                        }}
                      >
                        {d.name}
                      </code>
                      {/* Old → new */}
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {current !== undefined ? current : '?'}
                        {' → '}
                        <span
                          style={{
                            color:
                              direction === 'up'
                                ? 'var(--ctp-green)'
                                : direction === 'down'
                                ? 'var(--ctp-red)'
                                : 'var(--text)',
                            fontWeight: 600,
                          }}
                        >
                          {proposed !== null ? proposed : d.new_value}
                        </span>
                      </span>
                    </div>

                    {/* Reason */}
                    {d.reason && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        {d.reason}
                      </p>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <button
                        onClick={() => acceptDelta(idx, d)}
                        disabled={saveConfig.isPending}
                        style={{
                          ...btnPrimaryStyle,
                          opacity: saveConfig.isPending ? 0.7 : 1,
                          cursor: saveConfig.isPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <CheckCircle size={12} />
                        Accept
                      </button>
                      <button onClick={() => rejectDelta(idx)} style={btnGhostStyle}>
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Empty state */}
          {!result && !loading && !error && !noKey && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>
              Click <strong>Run tune</strong> to get AI suggestions for your urgency weights.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
