/**
 * DecomposeSheet — LLM goal decomposer, shown as a Radix Dialog.
 *
 * On open: calls window.gk.runDecompose(goal.id) → DraftPlan.
 * Renders a preview tree (projects → tasks) with checkboxes to include/exclude.
 * "Save" creates included items:
 *   1. For each included project: addProject → capture id.
 *   2. For each included task in that project:
 *      - Compute due from due_offset_days (today + N days, YYYY-MM-DD or null).
 *      - estimateMinutes = asInt(estimate_minutes).
 *      - priority = coercePriority(priority).
 *      - tags = task.tags.
 *      - First-pass: create all tasks sequentially, build index→id map.
 *      - Second-pass: for tasks whose depends_on refs all land on earlier
 *        tasks, wire deps via modifyTask (mirrors decompose.py).
 *        Forward refs that resolved to a task not yet created are skipped
 *        gracefully (they point to tasks that ended up excluded or out of order).
 *
 * Mirrors decompose.py's persist_plan logic faithfully.
 */

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Goal } from '@core/models'
import { num, asInt, coercePriority } from '@core/llm/schemas'
import type { DraftPlan, DraftProject, DraftTask } from '@core/llm/schemas'
import { useAddProject, useAddTask, useModifyTask } from '../../hooks/useGk'
import { useNav } from '../../lib/nav'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNoKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('NoApiKey') || msg.toLowerCase().includes('api key')
}

/** today + N days → YYYY-MM-DD, or null */
function offsetToDate(offset: string): string | null {
  const days = asInt(offset)
  if (days === null) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
  width: '560px',
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

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '7px 18px',
  borderRadius: 7,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '7px 14px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 13,
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 99,
        padding: '1px 6px',
      }}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// DecomposeSheet
// ---------------------------------------------------------------------------

export function DecomposeSheet({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  goal: Goal
}) {
  const { go } = useNav()
  const addProject = useAddProject()
  const addTask = useAddTask()
  const modifyTask = useModifyTask()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noKey, setNoKey] = useState(false)
  const [plan, setPlan] = useState<DraftPlan | null>(null)
  const [saving, setSaving] = useState(false)

  // Selection state: Set of "p{pIdx}" for projects, "p{pIdx}.t{tIdx}" for tasks
  const [included, setIncluded] = useState<Set<string>>(new Set())
  // Collapsed state for project rows
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  // Auto-run on open
  useEffect(() => {
    if (!open) return
    setPlan(null)
    setError(null)
    setNoKey(false)
    setIncluded(new Set())
    setCollapsed(new Set())
    setLoading(true)
    window.gk
      .runDecompose(goal.id)
      .then((r) => {
        setPlan(r)
        // Default: include everything
        const sel = new Set<string>()
        r.projects.forEach((_, pi) => {
          sel.add(`p${pi}`)
          ;(r.projects[pi] as DraftProject).tasks.forEach((_, ti) => {
            sel.add(`p${pi}.t${ti}`)
          })
        })
        setIncluded(sel)
      })
      .catch((err) => {
        if (isNoKeyError(err)) {
          setNoKey(true)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => setLoading(false))
  }, [open, goal.id])

  function toggleProject(pi: number, tasks: DraftTask[]) {
    const key = `p${pi}`
    const next = new Set(included)
    if (next.has(key)) {
      // Deselect project + all its tasks
      next.delete(key)
      tasks.forEach((_, ti) => next.delete(`p${pi}.t${ti}`))
    } else {
      next.add(key)
      tasks.forEach((_, ti) => next.add(`p${pi}.t${ti}`))
    }
    setIncluded(next)
  }

  function toggleTask(pi: number, ti: number) {
    const taskKey = `p${pi}.t${ti}`
    const projKey = `p${pi}`
    const next = new Set(included)
    if (next.has(taskKey)) {
      next.delete(taskKey)
      // If no tasks remain included for this project, deselect project too
      const anyLeft = plan?.projects[pi].tasks.some((_, i) => i !== ti && next.has(`p${pi}.t${i}`))
      if (!anyLeft) next.delete(projKey)
    } else {
      next.add(taskKey)
      next.add(projKey) // ensure project is included when a task is included
    }
    setIncluded(next)
  }

  function toggleCollapse(pi: number) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(pi)) next.delete(pi)
      else next.add(pi)
      return next
    })
  }

  async function handleSave() {
    if (!plan) return
    setSaving(true)
    let totalProjects = 0
    let totalTasks = 0

    try {
      for (let pi = 0; pi < plan.projects.length; pi++) {
        if (!included.has(`p${pi}`)) continue
        const dp = plan.projects[pi]

        // Create the project
        const project = await addProject.mutateAsync({
          title: dp.title,
          opts: { goalId: goal.id, description: dp.description },
        })
        totalProjects++

        // First pass: create all included tasks sequentially, build index→id map
        // Index here is the 1-based position within dp.tasks (per decompose.py convention)
        const idMap: Map<number, string> = new Map() // 1-based task index → real task id
        const createdTasks: Array<{ id: string; draftTask: DraftTask; oneBasedIdx: number }> = []

        let oneBasedIdx = 0
        for (let ti = 0; ti < dp.tasks.length; ti++) {
          oneBasedIdx++ // always increment to preserve 1-based numbering from the model
          if (!included.has(`p${pi}.t${ti}`)) continue
          const dt = dp.tasks[ti]

          const task = await addTask.mutateAsync({
            title: dt.title,
            opts: {
              projectId: project.id,
              priority: coercePriority(dt.priority),
              due: offsetToDate(dt.due_offset_days),
              estimateMinutes: asInt(dt.estimate_minutes),
              tags: dt.tags,
            },
          })
          idMap.set(oneBasedIdx, task.id)
          createdTasks.push({ id: task.id, draftTask: dt, oneBasedIdx })
          totalTasks++
        }

        // Second pass: wire depends_on (1-based indices within this project's task list)
        // Only wire deps to tasks that were included (present in idMap)
        for (const { id: taskId, draftTask } of createdTasks) {
          if (!draftTask.depends_on || draftTask.depends_on.length === 0) continue

          const depIds: string[] = []
          for (const ref of draftTask.depends_on) {
            const refIdx = asInt(ref)
            if (refIdx === null) continue
            const depId = idMap.get(refIdx)
            if (!depId || depId === taskId) continue // skip self-refs and missing
            depIds.push(depId)
          }

          if (depIds.length > 0) {
            // Fetch current task state so we can patch it
            // We use modifyTask which takes a full Task object, so we need to get the task
            // The addTask mutateAsync returned the task; we can approximate by re-fetching
            // via the query cache, but the simplest is to use the returned task from addTask.
            // We stored the id; we'll build a minimal Task patch using window.gk.listTasks.
            // Actually: use modifyTask with the shape we know. We need a full Task.
            // The safest approach: re-call window.gk.listTasks and find by id.
            const allTasks = await window.gk.listTasks(project.id, null)
            const task = allTasks.find((t) => t.id === taskId)
            if (task) {
              await modifyTask.mutateAsync({ ...task, depends: depIds })
            }
          }
        }
      }

      toast.success(
        `Created ${totalProjects} project${totalProjects !== 1 ? 's' : ''} and ${totalTasks} task${totalTasks !== 1 ? 's' : ''} under "${goal.title}"`,
      )
      onOpenChange(false)
      go({ kind: 'goal', id: goal.id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const includedProjectCount = plan?.projects.filter((_, pi) => included.has(`p${pi}`)).length ?? 0
  const includedTaskCount =
    plan?.projects.reduce(
      (acc, dp, pi) =>
        acc + dp.tasks.filter((_, ti) => included.has(`p${pi}.t${ti}`)).length,
      0,
    ) ?? 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
      {open && (
      <Dialog.Portal forceMount>
        <Dialog.Overlay asChild>
          <motion.div
            style={overlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild aria-describedby={undefined}>
        <motion.div
          style={contentStyle}
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--ctp-yellow)" />
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Decompose: {goal.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ ...btnGhostStyle, padding: '4px 8px' }}>
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Loading */}
          {loading && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0' }}>
              Asking Gemini to break down the goal…
            </p>
          )}

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
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>
              Add a Gemini API key in Settings to use AI features.
            </p>
          )}

          {/* Plan preview */}
          {plan && !loading && (
            <>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
                {plan.projects.length} project{plan.projects.length !== 1 ? 's' : ''}
                {' · '}
                {plan.projects.reduce((a, p) => a + p.tasks.length, 0)} task{plan.projects.reduce((a, p) => a + p.tasks.length, 0) !== 1 ? 's' : ''}
                {' proposed. Select what to create.'}
              </p>

              {plan.projects.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
                  The model proposed no projects.
                </p>
              )}

              {plan.projects.map((dp, pi) => {
                const projKey = `p${pi}`
                const projIncluded = included.has(projKey)
                const isCollapsed = collapsed.has(pi)

                return (
                  <div
                    key={pi}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Project row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        background: 'var(--bg)',
                        borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={projIncluded}
                        onChange={() => toggleProject(pi, dp.tasks)}
                        style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                      />
                      <button
                        onClick={() => toggleCollapse(pi)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: projIncluded ? 'var(--text)' : 'var(--text-dim)',
                          flex: 1,
                        }}
                      >
                        {dp.title}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {dp.tasks.length} task{dp.tasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Tasks */}
                    {!isCollapsed && dp.tasks.length > 0 && (
                      <div style={{ background: 'var(--surface)' }}>
                        {dp.tasks.map((dt, ti) => {
                          const taskKey = `p${pi}.t${ti}`
                          const taskIncluded = included.has(taskKey)
                          const due = offsetToDate(dt.due_offset_days)
                          const est = asInt(dt.estimate_minutes)
                          const pri = coercePriority(dt.priority)

                          return (
                            <label
                              key={ti}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                padding: '8px 14px 8px 36px',
                                borderBottom: ti < dp.tasks.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={taskIncluded}
                                onChange={() => toggleTask(pi, ti)}
                                style={{ accentColor: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: taskIncluded ? 'var(--text)' : 'var(--text-dim)',
                                    marginBottom: 3,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: 'var(--text-dim)',
                                      fontVariantNumeric: 'tabular-nums',
                                      marginRight: 5,
                                    }}
                                  >
                                    {ti + 1}.
                                  </span>
                                  {dt.title}
                                </div>
                                {/* Meta badges */}
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {pri !== 'none' && <MetaBadge>pri: {pri}</MetaBadge>}
                                  {due && <MetaBadge>due {due}</MetaBadge>}
                                  {est !== null && <MetaBadge>{est}m</MetaBadge>}
                                  {dt.tags.map((tag) => (
                                    <MetaBadge key={tag}>#{tag}</MetaBadge>
                                  ))}
                                  {dt.depends_on.length > 0 && (
                                    <MetaBadge>after {dt.depends_on.join(', ')}</MetaBadge>
                                  )}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* Footer actions */}
          {plan && !loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Dialog.Close asChild>
                <button style={btnGhostStyle} disabled={saving}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={saving || includedProjectCount === 0}
                style={{
                  ...btnPrimaryStyle,
                  opacity: saving || includedProjectCount === 0 ? 0.6 : 1,
                  cursor: saving || includedProjectCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={13} />
                {saving
                  ? 'Creating…'
                  : `Create ${includedProjectCount} project${includedProjectCount !== 1 ? 's' : ''}, ${includedTaskCount} task${includedTaskCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
      )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
