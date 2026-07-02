/**
 * Sidebar — navigation + goals → projects tree with per-goal progress.
 *
 * Layout:
 *   Top nav items  (Dashboard, Ready, Now, Groom)
 *   ── GOALS section ── with inline add-goal input
 *     GoalRow (per goal): title + progress %, expandable to projects
 *   Bottom: Settings
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import {
  LayoutDashboard,
  CheckCircle,
  Sparkles,
  ListFilter,
  Settings,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
} from 'lucide-react'
import { useNav, type View } from '../lib/nav'
import { useGoals, useProjects, useTasks, useAddGoal } from '../hooks/useGk'
import type { Task, Project } from '@core/models'

// ---------------------------------------------------------------------------
// Nav item
// ---------------------------------------------------------------------------

interface NavItemProps {
  label: string
  icon: React.ReactNode
  view: View
  active: boolean
  onClick: () => void
}

function NavItem({ label, icon, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors"
      style={{
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// GoalRow — fetches its own projects, receives shared task list
// ---------------------------------------------------------------------------

interface GoalRowProps {
  id: string
  title: string
  allTasks: Task[]
  activeView: View
  go: (v: View) => void
}

function GoalRow({ id, title, allTasks, activeView, go }: GoalRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { data: projects = [] } = useProjects(id)

  // Progress: done tasks whose project_id is one of this goal's projects
  const projectIds = new Set(projects.map((p: Project) => p.id))
  const goalTasks = allTasks.filter((t) => t.project_id != null && projectIds.has(t.project_id))
  const total = goalTasks.length
  const done = goalTasks.filter((t) => t.status === 'done').length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  // Progress colour
  let progressColor: string
  if (pct >= 66) {
    progressColor = 'var(--ctp-green)'
  } else if (pct >= 33) {
    progressColor = 'var(--ctp-peach)'
  } else {
    progressColor = 'var(--ctp-blue)'
  }

  const isGoalActive = activeView.kind === 'goal' && activeView.id === id

  return (
    <div>
      {/* Goal row */}
      <div
        className="group flex items-center gap-1 rounded px-1 py-1 transition-colors"
        style={{
          background: isGoalActive ? 'var(--surface-2)' : 'transparent',
        }}
      >
        {/* Expand / collapse toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-dim)' }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Title — navigates to goal view */}
        <button
          onClick={() => go({ kind: 'goal', id })}
          className="flex-1 truncate text-left text-xs transition-colors hover:text-[var(--text)]"
          style={{ color: isGoalActive ? 'var(--text)' : 'var(--text-dim)' }}
          title={title}
        >
          {title}
        </button>

        {/* Progress badge */}
        <span
          className="shrink-0 rounded px-1 text-[10px] font-semibold leading-none"
          style={{ color: progressColor }}
        >
          {pct}%
        </span>
      </div>

      {/* Project sub-rows */}
      {expanded && projects.length > 0 && (
        <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
          {projects.map((p: Project) => {
            const isProjActive = activeView.kind === 'project' && activeView.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => go({ kind: 'project', id: p.id })}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors"
                style={{
                  background: isProjActive ? 'var(--surface-2)' : 'transparent',
                  color: isProjActive ? 'var(--text)' : 'var(--text-dim)',
                }}
                title={p.title}
              >
                <Folder size={11} style={{ color: 'var(--ctp-sapphire)', flexShrink: 0 }} />
                <span className="truncate">{p.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const { view, go } = useNav()
  const { data: goals = [] } = useGoals()
  // All tasks (no filter) for progress calculation
  const { data: allTasks = [] } = useTasks()
  const addGoal = useAddGoal()

  const [addingGoal, setAddingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the inline input when it appears
  useEffect(() => {
    if (addingGoal) inputRef.current?.focus()
  }, [addingGoal])

  function submitGoal() {
    const title = goalDraft.trim()
    if (title) {
      addGoal.mutate({ title })
    }
    setGoalDraft('')
    setAddingGoal(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submitGoal()
    if (e.key === 'Escape') {
      setGoalDraft('')
      setAddingGoal(false)
    }
  }

  return (
    <aside
      className="flex w-[220px] shrink-0 flex-col overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Top nav ── */}
      <nav className="flex flex-col gap-0.5 p-2 pt-3">
        <NavItem
          label="Dashboard"
          icon={<LayoutDashboard size={15} />}
          view={{ kind: 'dashboard' }}
          active={view.kind === 'dashboard'}
          onClick={() => go({ kind: 'dashboard' })}
        />
        <NavItem
          label="Ready"
          icon={<CheckCircle size={15} />}
          view={{ kind: 'ready' }}
          active={view.kind === 'ready'}
          onClick={() => go({ kind: 'ready' })}
        />
        <NavItem
          label="Now"
          icon={
            <Sparkles
              size={15}
              style={{ color: view.kind === 'now' ? 'var(--ctp-mauve)' : undefined }}
            />
          }
          view={{ kind: 'now' }}
          active={view.kind === 'now'}
          onClick={() => go({ kind: 'now' })}
        />
        <NavItem
          label="Groom"
          icon={<ListFilter size={15} />}
          view={{ kind: 'groom' }}
          active={view.kind === 'groom'}
          onClick={() => go({ kind: 'groom' })}
        />
      </nav>

      {/* Divider */}
      <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--border)' }} />

      {/* ── Goals section ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-dim)' }}
          >
            Goals
          </span>
          <button
            onClick={() => setAddingGoal(true)}
            className="flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-dim)' }}
            aria-label="Add goal"
            title="Add goal"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Inline add-goal input */}
        {addingGoal && (
          <div className="mx-2 mb-1">
            <input
              ref={inputRef}
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={submitGoal}
              placeholder="Goal title…"
              className="w-full rounded px-2 py-1 text-xs outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        )}

        {/* Goals list — scrollable */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex flex-col gap-0.5">
            {goals.map((goal) => (
              <GoalRow
                key={goal.id}
                id={goal.id}
                title={goal.title}
                allTasks={allTasks}
                activeView={view}
                go={go}
              />
            ))}
            {goals.length === 0 && !addingGoal && (
              <p
                className="px-1 py-2 text-center text-xs"
                style={{ color: 'var(--text-dim)' }}
              >
                No goals yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--border)' }} />

      {/* ── Bottom: Settings ── */}
      <nav className="p-2 pb-3">
        <NavItem
          label="Settings"
          icon={<Settings size={15} />}
          view={{ kind: 'settings' }}
          active={view.kind === 'settings'}
          onClick={() => go({ kind: 'settings' })}
        />
      </nav>
    </aside>
  )
}
