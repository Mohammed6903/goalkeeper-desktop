/**
 * Board — kanban-style three-column view: Pending | Active | Done.
 *
 * Uses @dnd-kit/core (useDraggable + useDroppable + DndContext) to allow
 * dragging task cards between columns. On drop the correct mutation fires:
 *
 *   → pending  : useModifyTask with status:'pending', started_at:null, completed_at:null
 *   → active   : useStartTask(task.seq)  [if task was pending or done]
 *   → done     : useCompleteTask(task.seq)
 *
 * Cards show: #seq (mono dim), title, UrgencyBadge (hidden on done), tag chips.
 * Clicking a card fires onEdit?.(task).
 */

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core'
import type { Task } from '@core/models'
import { UrgencyBadge } from './UrgencyBadge'
import { useStartTask, useCompleteTask, useModifyTask } from '../hooks/useGk'

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

type ColumnStatus = 'pending' | 'active' | 'done'

const COLUMNS: { status: ColumnStatus; label: string; accent: string }[] = [
  { status: 'pending', label: 'Pending', accent: 'var(--ctp-blue)' },
  { status: 'active', label: 'Active', accent: 'var(--ctp-peach)' },
  { status: 'done', label: 'Done', accent: 'var(--ctp-green)' },
]

// ---------------------------------------------------------------------------
// TaskCard — single draggable card
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  isDragging = false,
  onEdit,
}: {
  task: Task
  isDragging?: boolean
  onEdit?: (t: Task) => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Don't open edit if we're mid-drag
        if (!transform) {
          e.stopPropagation()
          onEdit?.(task)
        }
      }}
    >
      <CardContent task={task} />
    </div>
  )
}

/** Pure visual card — used both in column and in DragOverlay */
function CardContent({ task }: { task: Task }) {
  const isDone = task.status === 'done'
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-shadow hover:shadow-md"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Top row: seq + urgency badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="mono shrink-0 text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          #{task.seq}
        </span>
        {!isDone && <UrgencyBadge score={task.urgency} />}
      </div>

      {/* Title */}
      <span
        className="text-sm leading-snug"
        style={{
          color: 'var(--text)',
          textDecoration: isDone ? 'line-through' : 'none',
          opacity: isDone ? 0.5 : 1,
          wordBreak: 'break-word',
        }}
      >
        {task.title}
      </span>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {task.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-1.5 py-0.5 text-[10px] leading-none"
              style={{
                background: `color-mix(in srgb, var(--ctp-mauve) 18%, transparent)`,
                color: 'var(--ctp-mauve)',
              }}
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 4 && (
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              +{task.tags.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column — droppable container
// ---------------------------------------------------------------------------

function Column({
  status,
  label,
  accent,
  tasks,
  activeId,
  onEdit,
}: {
  status: ColumnStatus
  label: string
  accent: string
  tasks: Task[]
  activeId: UniqueIdentifier | null
  onEdit?: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl"
      style={{
        background: isOver
          ? `color-mix(in srgb, ${accent} 8%, var(--surface))`
          : 'var(--surface)',
        border: `1px solid ${isOver ? accent : 'var(--border)'}`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Column header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: accent }}>
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className="min-h-[80px] flex-1 overflow-y-auto p-2"
        style={{ minHeight: '80px' }}
      >
        {tasks.length === 0 ? (
          <div
            className="flex items-center justify-center py-8 text-[12px]"
            style={{ color: 'var(--text-dim)', opacity: 0.5 }}
          >
            Drop cards here
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isDragging={activeId === task.id}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function Board({
  tasks,
  onEdit,
}: {
  tasks: Task[]
  onEdit?: (t: Task) => void
}) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const startTask = useStartTask()
  const completeTask = useCompleteTask()
  const modifyTask = useModifyTask()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small drag distance before activating so click works
      activationConstraint: { distance: 6 },
    }),
  )

  /** Map the task map for fast lookup */
  const taskById = new Map(tasks.map((t) => [t.id, t]))

  /** Move a task to the target column status via the correct mutation */
  function moveTo(task: Task, targetStatus: ColumnStatus) {
    if (task.status === targetStatus) return // no-op: same column

    if (targetStatus === 'active') {
      // startTask works for both pending→active and done→active
      startTask.mutate(task.seq)
    } else if (targetStatus === 'done') {
      completeTask.mutate(task.seq)
    } else {
      // targetStatus === 'pending' — reopen / reset the task
      modifyTask.mutate({
        ...task,
        status: 'pending',
        started_at: null,
        completed_at: null,
      })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)

    const { active, over } = event
    if (!over) return

    const task = taskById.get(active.id as string)
    if (!task) return

    const targetStatus = over.id as ColumnStatus
    moveTo(task, targetStatus)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  const activeTask = activeId ? taskById.get(activeId as string) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {COLUMNS.map(({ status, label, accent }) => (
          <Column
            key={status}
            status={status}
            label={label}
            accent={accent}
            tasks={tasks.filter((t) => t.status === status)}
            activeId={activeId}
            onEdit={onEdit}
          />
        ))}
      </div>

      {/* Floating overlay card while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            style={{
              cursor: 'grabbing',
              opacity: 0.95,
              transform: 'rotate(1.5deg) scale(1.02)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              borderRadius: '10px',
            }}
          >
            <CardContent task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
