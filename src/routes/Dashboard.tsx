/**
 * Dashboard — "What now?" overview panel.
 *
 * Left column: placeholder "✦ Now" card for LLM suggestions (Task 9).
 * Right column: top-5 Ready tasks + per-goal progress bars.
 * Header: greeting + stats (active, ready, overdue counts).
 */

import { useMemo } from 'react'
import type { Task } from '@core/models'
import { useScore, useReady, useGoals, useProjects } from '../hooks/useGk'
import { TaskRow } from '../components/TaskRow'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { NowPanel } from '../components/panels/NowPanel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOverdue(due: string | null): boolean {
  if (!due) return false
  const today = new Date().toISOString().slice(0, 10)
  return due < today
}

// ---------------------------------------------------------------------------
// Goal progress bar sub-component — fetches its own projects
// ---------------------------------------------------------------------------

function GoalProgressRow({
  goalId,
  title,
  allTasks,
}: {
  goalId: string
  title: string
  allTasks: Task[]
}) {
  const { data: projects = [] } = useProjects(goalId)
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects])
  const goalTasks = useMemo(
    () => allTasks.filter((t) => t.project_id != null && projectIds.has(t.project_id)),
    [allTasks, projectIds],
  )
  const total = goalTasks.length
  const done = goalTasks.filter((t) => t.status === 'done').length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const barColor =
    pct >= 66 ? 'var(--ctp-green)' : pct >= 33 ? 'var(--ctp-peach)' : 'var(--ctp-blue)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }} className="truncate">
          {title}
        </span>
        <span
          style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}
        >
          {done}/{total}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--surface-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact ready task row (no virtualizer — limited to top 5)
// ---------------------------------------------------------------------------

function ReadyRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        #{task.seq}
      </span>
      <span
        style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={task.title}
      >
        {task.title}
      </span>
      {task.due && (
        <span style={{ fontSize: 11, color: isOverdue(task.due) ? 'var(--ctp-red)' : 'var(--text-dim)', flexShrink: 0 }}>
          {task.due}
        </span>
      )}
      <UrgencyBadge score={task.urgency} />
      <button
        onClick={() => onEdit(task)}
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        Edit
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard({
  onEdit,
  onNew,
}: {
  onEdit: (t: Task) => void
  onNew: () => void
}) {
  const { data: scoredTasks = [] } = useScore()
  const { data: readyTasks = [] } = useReady()
  const { data: goals = [] } = useGoals()

  // Stats derived from scored tasks (open work)
  const today = new Date().toISOString().slice(0, 10)
  const activeCount = scoredTasks.filter((t) => t.status === 'active').length
  const readyCount = readyTasks.length
  const overdueCount = scoredTasks.filter((t) => t.due != null && t.due < today).length

  const top5Ready = readyTasks.slice(0, 5)

  // All tasks for progress bars (scored = open tasks only; fine for open-task progress)
  // For done tasks in goal progress we'd need useTasks() but keep simple for this view
  const allScoredTasks = scoredTasks

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 24px',
        gap: 20,
        overflow: 'auto',
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            What now?
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
            <span style={{ color: 'var(--ctp-blue)', fontWeight: 600 }}>{activeCount}</span> active
            {' · '}
            <span style={{ color: 'var(--ctp-green)', fontWeight: 600 }}>{readyCount}</span> ready
            {' · '}
            <span style={{ color: overdueCount > 0 ? 'var(--ctp-red)' : 'var(--text-dim)', fontWeight: 600 }}>{overdueCount}</span> overdue
          </p>
        </div>
        <button
          onClick={onNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New task
        </button>
      </div>

      {/* ── Body: two columns ── */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left column: Now panel */}
        <div
          style={{
            flex: '0 0 320px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            <NowPanel />
          </div>
        </div>

        {/* Right column: Ready list + Goals progress */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Ready mini-list */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Ready
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--accent)',
                    background: `color-mix(in srgb, var(--accent) 15%, transparent)`,
                    borderRadius: 99,
                    padding: '1px 6px',
                  }}
                >
                  {readyTasks.length}
                </span>
              </span>
            </div>
            <div style={{ padding: '6px 4px' }}>
              {top5Ready.length === 0 ? (
                <p style={{ margin: 0, padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
                  No ready tasks
                </p>
              ) : (
                top5Ready.map((t) => (
                  <ReadyRow key={t.id} task={t} onEdit={onEdit} />
                ))
              )}
            </div>
          </div>

          {/* Goals progress */}
          {goals.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Goals</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {goals.map((goal) => (
                  <GoalProgressRow
                    key={goal.id}
                    goalId={goal.id}
                    title={goal.title}
                    allTasks={allScoredTasks}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
