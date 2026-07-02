/**
 * TaskRow — a single row in the task list.
 *
 * Features:
 *  - Sequence number (mono, dim), title (strike-through when done),
 *    tag chips, due date (red when past), UrgencyBadge.
 *  - Inline hover quick-actions: Start (pending only) and Done (!done).
 *  - Radix ContextMenu (right-click) with Start, Done, Edit, Set priority
 *    (submenu), separator, Delete.
 */

import { useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import type { Task } from '@core/models'
import { UrgencyBadge } from './UrgencyBadge'
import {
  useStartTask,
  useCompleteTask,
  useModifyTask,
  useDeleteTask,
} from '../hooks/useGk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOverdue(due: string | null): boolean {
  if (!due) return false
  // due is YYYY-MM-DD; today is also YYYY-MM-DD without time
  const today = new Date().toISOString().slice(0, 10)
  return due < today
}

// ---------------------------------------------------------------------------
// Context menu styles (reused across items)
// ---------------------------------------------------------------------------

const menuContentStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '4px',
  minWidth: '180px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  zIndex: 9999,
}

const itemBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 8px',
  borderRadius: '5px',
  fontSize: '13px',
  color: 'var(--text)',
  cursor: 'default',
  outline: 'none',
  userSelect: 'none',
}

const itemHoverStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
}

// ---------------------------------------------------------------------------
// Sub-components for hover-stateful menu items
// ---------------------------------------------------------------------------

function MenuItem({
  children,
  onSelect,
  disabled = false,
  destructive = false,
}: {
  children: React.ReactNode
  onSelect?: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...itemBaseStyle,
        ...(hovered && !disabled ? itemHoverStyle : {}),
        color: destructive
          ? 'var(--ctp-red)'
          : disabled
            ? 'var(--text-dim)'
            : 'var(--text)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </ContextMenu.Item>
  )
}

function SubTriggerItem({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <ContextMenu.SubTrigger
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...itemBaseStyle,
        ...(hovered ? itemHoverStyle : {}),
        justifyContent: 'space-between',
      }}
    >
      {children}
      <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>▸</span>
    </ContextMenu.SubTrigger>
  )
}

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

export function TaskRow({
  task,
  onEdit,
}: {
  task: Task
  onEdit?: (t: Task) => void
}) {
  const [rowHovered, setRowHovered] = useState(false)

  const startTask = useStartTask()
  const completeTask = useCompleteTask()
  const modifyTask = useModifyTask()
  const deleteTask = useDeleteTask()

  const isPending = task.status === 'pending'
  const isDone = task.status === 'done'
  const overdue = isOverdue(task.due)

  function handleStart() {
    startTask.mutate(task.seq)
  }

  function handleDone() {
    completeTask.mutate(task.seq)
  }

  function handleSetPriority(priority: 'high' | 'medium' | 'low' | 'none') {
    modifyTask.mutate({ ...task, priority })
  }

  function handleDelete() {
    deleteTask.mutate(task.id)
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className="group flex items-center gap-2 rounded px-3 py-2 transition-colors"
          style={{
            background: rowHovered ? 'var(--surface-2)' : 'transparent',
            cursor: 'default',
          }}
          onMouseEnter={() => setRowHovered(true)}
          onMouseLeave={() => setRowHovered(false)}
        >
          {/* Sequence number */}
          <span
            className="mono shrink-0 text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            #{task.seq}
          </span>

          {/* Title */}
          <span
            className="min-w-0 flex-1 truncate text-sm"
            style={{
              color: 'var(--text)',
              textDecoration: isDone ? 'line-through' : 'none',
              opacity: isDone ? 0.5 : 1,
            }}
            title={task.title}
          >
            {task.title}
          </span>

          {/* Tag chips */}
          {task.tags.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {task.tags.slice(0, 3).map((tag) => (
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
              {task.tags.length > 3 && (
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-dim)' }}
                >
                  +{task.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Due date */}
          {task.due && (
            <span
              className="mono shrink-0 text-[11px]"
              style={{ color: overdue ? 'var(--ctp-red)' : 'var(--text-dim)' }}
            >
              {task.due}
            </span>
          )}

          {/* Inline quick actions (visible on hover) */}
          <div
            className="flex shrink-0 items-center gap-1 transition-opacity"
            style={{ opacity: rowHovered ? 1 : 0 }}
          >
            {isPending && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleStart()
                }}
                className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                style={{
                  background: `color-mix(in srgb, var(--ctp-blue) 18%, transparent)`,
                  color: 'var(--ctp-blue)',
                }}
                title="Start task"
              >
                Start
              </button>
            )}
            {!isDone && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDone()
                }}
                className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                style={{
                  background: `color-mix(in srgb, var(--ctp-green) 18%, transparent)`,
                  color: 'var(--ctp-green)',
                }}
                title="Mark done"
              >
                Done
              </button>
            )}
          </div>

          {/* Urgency badge */}
          <UrgencyBadge score={task.urgency} />
        </div>
      </ContextMenu.Trigger>

      {/* Right-click context menu */}
      <ContextMenu.Portal>
        <ContextMenu.Content style={menuContentStyle}>
          <MenuItem disabled={!isPending} onSelect={handleStart}>
            Start
          </MenuItem>
          <MenuItem disabled={isDone} onSelect={handleDone}>
            Mark done
          </MenuItem>
          <MenuItem onSelect={() => onEdit?.(task)}>Edit…</MenuItem>

          {/* Priority submenu */}
          <ContextMenu.Sub>
            <SubTriggerItem>Set priority</SubTriggerItem>
            <ContextMenu.Portal>
              <ContextMenu.SubContent style={menuContentStyle}>
                {(
                  [
                    { label: 'High', value: 'high', color: 'var(--ctp-red)' },
                    {
                      label: 'Medium',
                      value: 'medium',
                      color: 'var(--ctp-peach)',
                    },
                    { label: 'Low', value: 'low', color: 'var(--ctp-blue)' },
                    {
                      label: 'None',
                      value: 'none',
                      color: 'var(--text-dim)',
                    },
                  ] as const
                ).map(({ label, value, color }) => (
                  <MenuItem
                    key={value}
                    onSelect={() => handleSetPriority(value)}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    {label}
                  </MenuItem>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator
            style={{
              height: '1px',
              background: 'var(--border)',
              margin: '4px 0',
            }}
          />

          <MenuItem destructive onSelect={handleDelete}>
            Delete
          </MenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
