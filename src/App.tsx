import { useNav } from './lib/nav'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'

export default function App() {
  const { view } = useNav()

  // Derive a human-readable label for the placeholder
  const viewLabel =
    view.kind === 'goal' || view.kind === 'project'
      ? `${view.kind} · ${view.id}`
      : view.kind

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <TitleBar />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content — Task 7.4 replaces this with routed views */}
        <main
          className="flex flex-1 flex-col overflow-auto"
          style={{ background: 'var(--bg)' }}
        >
          <div
            className="flex flex-1 items-center justify-center text-sm"
            style={{ color: 'var(--text-dim)' }}
          >
            {/* Task 7.4 replaces this with routed views */}
            {viewLabel}
          </div>
        </main>
      </div>
    </div>
  )
}
