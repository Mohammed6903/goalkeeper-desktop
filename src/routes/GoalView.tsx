/**
 * GoalView — detail panel for a single goal.
 *
 * Shows goal title / description / status, lists its projects, and a TaskList
 * of all open tasks belonging to those projects (sourced from useScore() for
 * urgency-bearing tasks, filtered by project membership).
 *
 * Header actions: Mark done, Decompose (Task 8.4 placeholder), + New task.
 */

import { useMemo } from 'react'
import { CheckCircle, Sparkles } from 'lucide-react'
import type { Task } from '@core/models'
import { useGoals, useProjects, useScore, useCompleteGoal } from '../hooks/useGk'
import { TaskList } from '../components/TaskList'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'done'
      ? 'var(--ctp-green)'
      : status === 'active'
        ? 'var(--ctp-blue)'
        : 'var(--text-dim)'
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        borderRadius: 99,
        padding: '2px 8px',
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// GoalView
// ---------------------------------------------------------------------------

export function GoalView({
  goalId,
  onEdit,
  onNew,
}: {
  goalId: string
  onEdit: (t: Task) => void
  onNew: (projectId?: string) => void
}) {
  const { data: goals = [] } = useGoals()
  const { data: projects = [] } = useProjects(goalId)
  const { data: scoredTasks = [] } = useScore()
  const completeGoal = useCompleteGoal()

  const goal = goals.find((g) => g.id === goalId)

  // Collect project IDs belonging to this goal
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects])

  // Filter scored (open, urgency-bearing) tasks to those in this goal's projects
  const goalTasks = useMemo(
    () => scoredTasks.filter((t) => t.project_id != null && projectIds.has(t.project_id)),
    [scoredTasks, projectIds],
  )

  if (!goal) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 14,
        }}
      >
        Goal not found.
      </div>
    )
  }

  const isDone = goal.status === 'done'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text)',
                  textDecoration: isDone ? 'line-through' : 'none',
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                {goal.title}
              </h2>
              <StatusPill status={goal.status} />
            </div>
            {goal.description && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {goal.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => onNew()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New task
            </button>
            {/* Decompose placeholder — Task 8.4 */}
            <button
              title="Decompose into projects (Task 8.4)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-dim)',
                fontSize: 12,
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
              disabled
            >
              <Sparkles size={13} />
              Decompose
            </button>
            <button
              onClick={() => completeGoal.mutate(goalId)}
              disabled={isDone || completeGoal.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: isDone ? 'var(--text-dim)' : 'var(--ctp-green)',
                fontSize: 12,
                cursor: isDone ? 'default' : 'pointer',
                opacity: isDone || completeGoal.isPending ? 0.5 : 1,
              }}
            >
              <CheckCircle size={13} />
              Mark done
            </button>
          </div>
        </div>

        {/* Projects sub-list */}
        {projects.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {projects.map((p) => (
              <span
                key={p.id}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: `color-mix(in srgb, var(--ctp-sapphire) 15%, transparent)`,
                  color: 'var(--ctp-sapphire)',
                  fontWeight: 500,
                }}
              >
                {p.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Task list ── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TaskList tasks={goalTasks} title="Tasks" onEdit={onEdit} />
      </div>
    </div>
  )
}
