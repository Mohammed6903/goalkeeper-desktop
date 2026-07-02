/**
 * TaskList — virtualized list of tasks with a header and empty state.
 *
 * Uses @tanstack/react-virtual (useVirtualizer) for efficient rendering
 * of large lists without mounting every TaskRow to the DOM.
 *
 * Props:
 *   tasks   — array of Task objects to display
 *   title   — section heading (defaults to "Tasks")
 *   view    — current display mode: 'list' | 'board'
 *   onView  — callback when the user toggles the view mode
 *   onEdit  — forwarded to each TaskRow for the Edit… context menu action
 */

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LayoutList, LayoutGrid, Inbox } from 'lucide-react'
import type { Task } from '@core/models'
import { TaskRow } from './TaskRow'

// Row height in px — must be consistent so the virtualizer can calculate offsets.
const ROW_HEIGHT = 44

// ---------------------------------------------------------------------------
// Segmented List / Board toggle
// ---------------------------------------------------------------------------

function ViewToggle({
  view,
  onView,
}: {
  view: 'list' | 'board'
  onView?: (v: 'list' | 'board') => void
}) {
  return (
    <div
      className="flex items-center rounded p-0.5"
      style={{ background: 'var(--surface-2)' }}
    >
      {(
        [
          { v: 'list', Icon: LayoutList, label: 'List' },
          { v: 'board', Icon: LayoutGrid, label: 'Board' },
        ] as const
      ).map(({ v, Icon, label }) => (
        <button
          key={v}
          aria-label={label}
          title={label}
          onClick={() => onView?.(v)}
          className="flex items-center justify-center rounded p-1 transition-colors"
          style={{
            background: view === v ? 'var(--surface)' : 'transparent',
            color: view === v ? 'var(--text)' : 'var(--text-dim)',
            boxShadow:
              view === v ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-12"
      style={{ color: 'var(--text-dim)' }}
    >
      <Inbox size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
      <span className="text-sm" style={{ opacity: 0.6 }}>
        Nothing here yet.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskList
// ---------------------------------------------------------------------------

export function TaskList({
  tasks,
  title,
  view = 'list',
  onView,
  onEdit,
}: {
  tasks: Task[]
  title?: string
  view?: 'list' | 'board'
  onView?: (v: 'list' | 'board') => void
  onEdit?: (t: Task) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {title ?? 'Tasks'}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: `color-mix(in srgb, var(--accent) 15%, transparent)`,
              color: 'var(--accent)',
            }}
          >
            {tasks.length}
          </span>
        </div>

        <ViewToggle view={view} onView={onView} />
      </div>

      {/* ── Body ── */}
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        /* Scroll container — must have a fixed/capped height */
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        >
          {/* Inner container sized to the total virtual height */}
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {items.map((virtualRow) => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TaskRow task={tasks[virtualRow.index]} onEdit={onEdit} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
