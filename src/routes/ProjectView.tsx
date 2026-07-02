/**
 * ProjectView — detail panel for a single project.
 *
 * Shows project title / status, and a TaskList of open tasks (from useScore(),
 * filtered to this project_id for urgency-bearing tasks).
 *
 * Header actions: Mark done, + New task (pre-fills projectId in the form).
 */

import { useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import type { Task } from '@core/models'
import { useProjects, useScore, useCompleteProject } from '../hooks/useGk'
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
// ProjectView
// ---------------------------------------------------------------------------

export function ProjectView({
  projectId,
  onEdit,
  onNew,
}: {
  projectId: string
  onEdit: (t: Task) => void
  onNew: (projectId?: string) => void
}) {
  // Fetch all projects (no goalId filter) so we can find this one by id
  const { data: allProjects = [] } = useProjects()
  const { data: scoredTasks = [] } = useScore()
  const completeProject = useCompleteProject()

  const project = allProjects.find((p) => p.id === projectId)

  // Open tasks belonging to this project (urgency from score())
  const projectTasks = useMemo(
    () => scoredTasks.filter((t) => t.project_id === projectId),
    [scoredTasks, projectId],
  )

  if (!project) {
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
        Project not found.
      </div>
    )
  }

  const isDone = project.status === 'done'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
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
              {project.title}
            </h2>
            <StatusPill status={project.status} />
          </div>
          {project.description && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {project.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onNew(projectId)}
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
          <button
            onClick={() => completeProject.mutate(projectId)}
            disabled={isDone || completeProject.isPending}
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
              opacity: isDone || completeProject.isPending ? 0.5 : 1,
            }}
          >
            <CheckCircle size={13} />
            Mark done
          </button>
        </div>
      </div>

      {/* ── Task list ── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TaskList tasks={projectTasks} title="Tasks" onEdit={onEdit} />
      </div>
    </div>
  )
}
