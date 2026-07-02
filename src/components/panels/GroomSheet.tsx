/**
 * GroomSheet — LLM backlog groomer panel.
 *
 * Calls window.gk.runGroom() → GroomResult.
 * Each proposed op shows type, target task, detail, and value.
 * Accept applies the op via the appropriate mutation; Reject removes it.
 *
 * Apply semantics mirror groom.py:
 *   set_priority   → modifyTask({ ...task, priority: coercePriority(value) })
 *   set_deadline   → modifyTask({ ...task, due: value || null })
 *   add_tag        → modifyTask({ ...task, tags: deduplicated union })
 *   mark_stale     → modifyTask({ ...task, tags: [...tags, 'stale'] })
 *   split          → addTask for each subtask (same project); deleteTask(original)
 *   merge_duplicate → deleteTask(task_ref); keep merge_into
 */

import { useState } from 'react'
import { CheckCircle, XCircle, Scissors, Tag, Clock, ArrowUpDown, AlertTriangle, GitMerge, Wand2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { coercePriority } from '@core/llm/schemas'
import type { DraftChangeOp, GroomResult } from '@core/llm/schemas'
import {
  useModifyTask,
  useDeleteTask,
  useAddTask,
  useTasks,
} from '../../hooks/useGk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNoKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NoApiKey') || msg.toLowerCase().includes('api key')
}

function opIcon(op: string) {
  switch (op) {
    case 'split': return <Scissors size={13} />
    case 'set_deadline': return <Clock size={13} />
    case 'set_priority': return <ArrowUpDown size={13} />
    case 'add_tag': return <Tag size={13} />
    case 'mark_stale': return <AlertTriangle size={13} />
    case 'merge_duplicate': return <GitMerge size={13} />
    default: return <Wand2 size={13} />
  }
}

function opLabel(op: string): string {
  return op.replace(/_/g, ' ')
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const headerStyle: React.CSSProperties = {
  padding: '16px 20px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'flex',
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
  display: 'flex',
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
// GroomSheet
// ---------------------------------------------------------------------------

export function GroomSheet() {
  const { data: allTasks = [] } = useTasks()
  const modifyTask = useModifyTask()
  const deleteTask = useDeleteTask()
  const addTask = useAddTask()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)
  const [result, setResult] = useState<GroomResult | null>(null)
  // ops that have been dismissed or accepted
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
      const r = await window.gk.runGroom()
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

  function findTaskBySeq(ref: string) {
    const seq = Number(ref)
    return allTasks.find((t) => t.seq === seq) ?? null
  }

  async function applyOp(idx: number, op: DraftChangeOp) {
    const task = findTaskBySeq(op.task_ref)

    try {
      switch (op.op) {
        case 'set_priority': {
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          await modifyTask.mutateAsync({ ...task, priority: coercePriority(op.value) })
          toast.success(`Set #${op.task_ref} priority → ${coercePriority(op.value)}`)
          break
        }
        case 'set_deadline': {
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          await modifyTask.mutateAsync({ ...task, due: op.value || null })
          toast.success(`Set #${op.task_ref} due → ${op.value || 'cleared'}`)
          break
        }
        case 'add_tag': {
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          const tag = op.value.trim()
          const newTags = Array.from(new Set([...task.tags, tag]))
          await modifyTask.mutateAsync({ ...task, tags: newTags })
          toast.success(`Tagged #${op.task_ref} "${tag}"`)
          break
        }
        case 'mark_stale': {
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          const newTags = Array.from(new Set([...task.tags, 'stale']))
          await modifyTask.mutateAsync({ ...task, tags: newTags })
          toast.success(`Flagged #${op.task_ref} as stale`)
          break
        }
        case 'split': {
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          const subs = op.subtasks.filter((s) => s.trim())
          if (subs.length === 0) throw new Error('No subtasks provided for split')
          for (const title of subs) {
            await addTask.mutateAsync({
              title,
              opts: { projectId: task.project_id ?? null, priority: task.priority },
            })
          }
          await deleteTask.mutateAsync(task.id)
          toast.success(`Split #${op.task_ref} into ${subs.length} subtask(s)`)
          break
        }
        case 'merge_duplicate': {
          // task_ref = the one to REMOVE; merge_into = the one to keep
          if (!task) throw new Error(`Task #${op.task_ref} not found`)
          const keepTask = findTaskBySeq(op.merge_into)
          if (!keepTask) throw new Error(`Keep task #${op.merge_into} not found`)
          if (keepTask.id === task.id) throw new Error('Cannot merge a task into itself')
          await deleteTask.mutateAsync(task.id)
          toast.success(`Merged #${op.task_ref} into #${op.merge_into}`)
          break
        }
        default:
          toast.error(`Unknown op type: ${op.op}`)
          return
      }

      setAccepted((prev) => new Set([...prev, idx]))
      setHidden((prev) => new Set([...prev, idx]))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  function rejectOp(idx: number) {
    setHidden((prev) => new Set([...prev, idx]))
  }

  const visibleOps = result?.ops
    .map((op, idx) => ({ op, idx }))
    .filter(({ idx }) => !hidden.has(idx)) ?? []

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <Wand2 size={18} color="var(--ctp-mauve)" />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Backlog Groomer
        </h2>
        {result && !loading && (
          <button onClick={run} style={btnGhostStyle}>
            <RefreshCw size={13} />
            Re-run
          </button>
        )}
        <button
          onClick={run}
          disabled={loading}
          style={{
            ...btnPrimaryStyle,
            fontSize: 13,
            padding: '6px 14px',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <Wand2 size={13} />
          {loading ? 'Grooming…' : 'Run groom'}
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* No API key */}
        {noKey && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Wand2 size={32} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Gemini API key required</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
              Add a Gemini API key in Settings to use AI features.
            </p>
          </div>
        )}

        {/* Error */}
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
          <div
            style={{
              color: 'var(--text-dim)',
              fontSize: 14,
              textAlign: 'center',
              padding: '40px 0',
            }}
          >
            Reviewing your backlog…
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Stats bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--text-dim)',
              }}
            >
              <span>{result.ops.length} suggestion{result.ops.length !== 1 ? 's' : ''}</span>
              {accepted.size > 0 && (
                <span style={{ color: 'var(--ctp-green)' }}>
                  · {accepted.size} applied
                </span>
              )}
              {hidden.size - accepted.size > 0 && (
                <span>· {hidden.size - accepted.size} rejected</span>
              )}
            </div>

            {visibleOps.length === 0 && (
              <div
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: '24px 0',
                }}
              >
                {result.ops.length === 0
                  ? 'Backlog looks clean — no changes proposed.'
                  : 'All suggestions handled.'}
              </div>
            )}

            {visibleOps.map(({ op, idx }) => {
              const task = findTaskBySeq(op.task_ref)
              return (
                <div key={idx} style={cardStyle}>
                  {/* Op type badge + target */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--ctp-mauve)',
                        background: 'color-mix(in srgb, var(--ctp-mauve) 15%, transparent)',
                        borderRadius: 99,
                        padding: '2px 8px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {opIcon(op.op)}
                      {opLabel(op.op)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-dim)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      task #{op.task_ref}
                      {task && (
                        <span style={{ color: 'var(--text)', marginLeft: 4 }}>
                          — {task.title}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Detail */}
                  {op.detail && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {op.detail}
                    </p>
                  )}

                  {/* Op-specific content */}
                  {op.op === 'split' && op.subtasks.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                      {op.subtasks.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {op.op === 'merge_duplicate' && op.merge_into && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
                      Keep task #{op.merge_into}
                      {(() => {
                        const keep = findTaskBySeq(op.merge_into)
                        return keep ? <span style={{ color: 'var(--text)' }}> — {keep.title}</span> : null
                      })()}
                    </p>
                  )}
                  {(op.op === 'set_priority' || op.op === 'set_deadline' || op.op === 'add_tag') && op.value && (
                    <p style={{ margin: 0, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-dim)' }}>→ </span>
                      <code
                        style={{
                          background: 'var(--surface-2)',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          color: 'var(--text)',
                        }}
                      >
                        {op.value}
                      </code>
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => applyOp(idx, op)}
                      style={btnPrimaryStyle}
                    >
                      <CheckCircle size={12} />
                      Accept
                    </button>
                    <button
                      onClick={() => rejectOp(idx)}
                      style={btnGhostStyle}
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Initial empty state */}
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
            <Wand2 size={32} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Click <strong>Run groom</strong> to review your backlog with AI.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
