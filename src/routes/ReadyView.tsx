/**
 * ReadyView — full list of ready (unblocked, open) tasks.
 * Delegates to <TaskList> backed by useReady().
 */

import type { Task } from '@core/models'
import { useReady } from '../hooks/useGk'
import { TaskList } from '../components/TaskList'
import { SkeletonList } from '../components/Skeleton'

export function ReadyView({ onEdit }: { onEdit: (t: Task) => void }) {
  const { data: tasks, isLoading } = useReady()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* View header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Ready</h2>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ padding: '8px 12px' }}>
          <SkeletonList n={7} />
        </div>
      )}

      {/* Task list fills remaining space */}
      {!isLoading && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <TaskList tasks={tasks ?? []} title="Ready" onEdit={onEdit} />
        </div>
      )}
    </div>
  )
}
