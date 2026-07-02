/**
 * CommandPalette — ⌘/Ctrl-K command palette powered by cmdk.
 *
 * Groups:
 *   - Go to: Dashboard, Ready, Now, Groom, Settings
 *   - Create: New task, New goal
 *   - Actions: Toggle theme
 *   - Tasks: Start / Complete per ready task (capped at 12)
 */

import { Command } from 'cmdk'
import {
  LayoutDashboard,
  CheckCircle,
  Sparkles,
  ListFilter,
  Settings,
  Plus,
  Target,
  Play,
  CircleCheck,
  Sun,
} from 'lucide-react'
import { useNav } from '../lib/nav'
import { useReady, useStartTask, useCompleteTask } from '../hooks/useGk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onNewTask: () => void
  onNewGoal: () => void
}

// ---------------------------------------------------------------------------
// Shared item style
// ---------------------------------------------------------------------------

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  color: 'var(--text)',
  userSelect: 'none',
  outline: 'none',
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onOpenChange, onNewTask, onNewGoal }: CommandPaletteProps) {
  const { go } = useNav()
  const { data: readyTasks = [] } = useReady()
  const startTask = useStartTask()
  const completeTask = useCompleteTask()

  function close() {
    onOpenChange(false)
  }

  function navigate(kind: 'dashboard' | 'ready' | 'now' | 'groom' | 'settings') {
    go({ kind })
    close()
  }

  function handleToggleTheme() {
    document.documentElement.classList.toggle('light')
    close()
  }

  const cappedTasks = readyTasks.slice(0, 12)

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      {/* Inline styles injected via a <style> tag to avoid needing a separate CSS file */}
      <style>{`
        /* Overlay */
        .cmdk-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          z-index: 50;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
        }

        /* Dialog card */
        .cmdk-content {
          width: 560px;
          max-width: calc(100vw - 32px);
          max-height: 60vh;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          display: flex;
          flex-direction: column;
          z-index: 51;
        }

        /* Override cmdk default dialog positioning — the overlay handles centering */
        [cmdk-dialog] {
          position: static !important;
          transform: none !important;
        }

        /* Input wrapper */
        [cmdk-input-wrapper] {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
        }

        /* Input */
        [cmdk-input] {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          color: var(--text);
        }

        [cmdk-input]::placeholder {
          color: var(--text-dim);
        }

        /* List */
        [cmdk-list] {
          flex: 1;
          overflow-y: auto;
          padding: 6px 6px 10px;
          max-height: calc(60vh - 56px);
        }

        /* Group heading */
        [cmdk-group-heading] {
          padding: 6px 10px 3px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-dim);
          opacity: 0.7;
        }

        /* Item hover + selected */
        [cmdk-item]:hover,
        [cmdk-item][aria-selected="true"] {
          background: var(--surface-2);
        }

        /* Empty state */
        [cmdk-empty] {
          padding: 24px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--text-dim);
        }
      `}</style>

      <Command.Input placeholder="Type a command or search…" />

      <Command.List>
        <Command.Empty>No results</Command.Empty>

        {/* ── Go to ── */}
        <Command.Group heading="Go to">
          <Command.Item
            style={itemStyle}
            value="go dashboard"
            keywords={['navigate', 'home', 'overview']}
            onSelect={() => navigate('dashboard')}
          >
            <LayoutDashboard size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            Dashboard
          </Command.Item>

          <Command.Item
            style={itemStyle}
            value="go ready"
            keywords={['navigate', 'tasks', 'ready', 'queue']}
            onSelect={() => navigate('ready')}
          >
            <CheckCircle size={15} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
            Ready
          </Command.Item>

          <Command.Item
            style={itemStyle}
            value="go now"
            keywords={['navigate', 'focus', 'now', 'active']}
            onSelect={() => navigate('now')}
          >
            <Sparkles size={15} style={{ color: 'var(--ctp-mauve)', flexShrink: 0 }} />
            Now
          </Command.Item>

          <Command.Item
            style={itemStyle}
            value="go groom"
            keywords={['navigate', 'groom', 'triage', 'review']}
            onSelect={() => navigate('groom')}
          >
            <ListFilter size={15} style={{ color: 'var(--ctp-peach)', flexShrink: 0 }} />
            Groom
          </Command.Item>

          <Command.Item
            style={itemStyle}
            value="go settings"
            keywords={['navigate', 'settings', 'preferences', 'config']}
            onSelect={() => navigate('settings')}
          >
            <Settings size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            Settings
          </Command.Item>
        </Command.Group>

        {/* ── Create ── */}
        <Command.Group heading="Create">
          <Command.Item
            style={itemStyle}
            value="new task create task add task"
            keywords={['create', 'add', 'task', 'new']}
            onSelect={() => {
              onNewTask()
              close()
            }}
          >
            <Plus size={15} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
            New task
          </Command.Item>

          <Command.Item
            style={itemStyle}
            value="new goal create goal add goal"
            keywords={['create', 'add', 'goal', 'new']}
            onSelect={() => {
              onNewGoal()
              close()
            }}
          >
            <Target size={15} style={{ color: 'var(--ctp-yellow)', flexShrink: 0 }} />
            New goal
          </Command.Item>
        </Command.Group>

        {/* ── Actions ── */}
        <Command.Group heading="Actions">
          <Command.Item
            style={itemStyle}
            value="toggle theme dark light mode appearance"
            keywords={['theme', 'dark', 'light', 'appearance', 'toggle']}
            onSelect={handleToggleTheme}
          >
            <Sun size={15} style={{ color: 'var(--ctp-yellow)', flexShrink: 0 }} />
            Toggle theme
          </Command.Item>
        </Command.Group>

        {/* ── Ready tasks ── */}
        {cappedTasks.length > 0 && (
          <Command.Group heading="Tasks">
            {cappedTasks.flatMap((task) => [
              <Command.Item
                key={`start-${task.seq}`}
                style={itemStyle}
                value={`start task ${task.seq} ${task.title}`}
                keywords={['start', 'begin', String(task.seq), task.title]}
                onSelect={() => {
                  startTask.mutate(task.seq)
                  close()
                }}
              >
                <Play size={14} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
                Start #{task.seq} — {task.title}
              </Command.Item>,

              <Command.Item
                key={`complete-${task.seq}`}
                style={itemStyle}
                value={`complete task done ${task.seq} ${task.title}`}
                keywords={['complete', 'done', 'finish', String(task.seq), task.title]}
                onSelect={() => {
                  completeTask.mutate(task.seq)
                  close()
                }}
              >
                <CircleCheck size={14} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
                Complete #{task.seq} — {task.title}
              </Command.Item>,
            ])}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  )
}
