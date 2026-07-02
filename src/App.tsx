import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '@core/models'
import { useNav } from './lib/nav'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import { TaskForm } from './components/TaskForm'
import { CommandPalette } from './components/CommandPalette'
import { Dashboard } from './routes/Dashboard'
import { ReadyView } from './routes/ReadyView'
import { GoalView } from './routes/GoalView'
import { ProjectView } from './routes/ProjectView'
import { NowPanel } from './components/panels/NowPanel'
import { GroomSheet } from './components/panels/GroomSheet'
import { useAddGoal } from './hooks/useGk'
import { Settings } from './components/Settings'

// ---------------------------------------------------------------------------
// Fallback placeholder for unrecognised routes
// ---------------------------------------------------------------------------

function ComingSoon({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ fontSize: 28, opacity: 0.25 }}>⌛</span>
      <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{label}</span>
      <span style={{ fontSize: 12, opacity: 0.55 }}>Coming soon</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const { view, go } = useNav()
  const addGoal = useAddGoal()

  // ── Global task-form state ──────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>()
  const [formProject, setFormProject] = useState<string | null>(null)

  // ── Command palette state ───────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openEdit = useCallback((task: Task) => {
    setEditing(task)
    setFormProject(null)
    setFormOpen(true)
  }, [])

  const openNew = useCallback((projectId?: string) => {
    setEditing(undefined)
    setFormProject(projectId ?? null)
    setFormOpen(true)
  }, [])

  // Global keyboard shortcuts
  // - Cmd/Ctrl-K → command palette
  // - n → new task
  // - g → open palette (user picks "New goal" there)
  // - / → open command palette (pragmatic focus/search fallback)
  // All single-key shortcuts are ignored when focus is inside an input,
  // textarea, select, or any contentEditable, so they don't fire mid-typing.
  useEffect(() => {
    function isTypingTarget(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null
      if (!t) return false
      const tag = t.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable
    }

    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl-K → palette (fires even in inputs — standard behaviour)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      // Remaining single-key shortcuts only fire when NOT typing in a field
      if (isTypingTarget(e)) return

      if (e.key === 'n') {
        e.preventDefault()
        openNew()
        return
      }

      if (e.key === 'g') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openNew])

  // Clear editing task when dialog closes so stale data doesn't linger
  function handleFormOpenChange(open: boolean) {
    setFormOpen(open)
    if (!open) setEditing(undefined)
  }

  // ── Routed main area ───────────────────────────────────────────────────
  function renderMain() {
    switch (view.kind) {
      case 'dashboard':
        return <Dashboard onEdit={openEdit} onNew={openNew} />
      case 'ready':
        return <ReadyView onEdit={openEdit} />
      case 'goal':
        return <GoalView goalId={view.id} onEdit={openEdit} onNew={openNew} />
      case 'project':
        return <ProjectView projectId={view.id} onEdit={openEdit} onNew={openNew} />
      case 'now':
        return <NowPanel />
      case 'groom':
        return <GroomSheet />
      case 'settings':
        return <Settings />
    }
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <TitleBar />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main
          className="flex flex-1 flex-col overflow-auto"
          style={{ background: 'var(--bg)', position: 'relative' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={view.kind === 'goal' ? `goal-${view.id}` : view.kind === 'project' ? `project-${view.id}` : view.kind}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}
            >
              {renderMain()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global task form — mounted once at root, controlled by state above */}
      <TaskForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        task={editing}
        defaultProjectId={formProject}
      />

      {/* Command palette — ⌘K / Ctrl-K */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNewTask={() => openNew()}
        onNewGoal={() => {
          // Create a placeholder goal then navigate to it
          addGoal.mutateAsync({ title: 'New goal' }).then((goal) => {
            go({ kind: 'goal', id: goal.id })
          })
        }}
      />
    </div>
  )
}
