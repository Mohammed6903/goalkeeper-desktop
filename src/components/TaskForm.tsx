/**
 * TaskForm — Radix Dialog modal for adding or editing a task.
 *
 * Props:
 *   open            – controls Dialog.Root open state
 *   onOpenChange    – called when the dialog requests a close
 *   task            – if provided, switches to "edit" mode
 *   defaultProjectId – pre-selects a project in "add" mode
 *
 * Fields: title, projectId, priority, due date, estimate (minutes), tags
 * (comma-separated), depends (multi-select checklist).
 *
 * Uses react-hook-form + zod for validation; native <select> and <input>
 * elements styled with Catppuccin CSS vars.
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import type { Task } from '@core/models'
import { useAddTask, useModifyTask, useProjects, useTasks } from '../hooks/useGk'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

// estimateMinutes is kept as a string in the form; converted on submit
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  projectId: z.string(), // '' → null on submit
  priority: z.enum(['high', 'medium', 'low', 'none']),
  due: z
    .string()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Must be YYYY-MM-DD or empty',
    }),
  estimateMinutes: z.string(), // raw string; validated + coerced on submit
  tags: z.string(), // comma-separated; split on submit
  depends: z.array(z.string()), // array of task ids
})

type FormValues = z.infer<typeof formSchema>

/** Parse the raw estimate string → number | undefined, or return an error string. */
function parseEstimate(raw: string): { value?: number; error?: string } {
  if (raw.trim() === '') return { value: undefined }
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return { error: 'Must be a positive whole number' }
  return { value: n }
}

// ---------------------------------------------------------------------------
// Style constants — reuse Catppuccin CSS vars throughout
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
  zIndex: 1000,
}

const contentStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '460px',
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '24px',
  boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-dim)',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const errorStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--ctp-red)',
  marginTop: '3px',
}

// ---------------------------------------------------------------------------
// TaskForm
// ---------------------------------------------------------------------------

export function TaskForm({
  open,
  onOpenChange,
  task,
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  task?: Task
  defaultProjectId?: string | null
}) {
  const isEdit = Boolean(task)

  const addTask = useAddTask()
  const modifyTask = useModifyTask()
  const { data: projects = [] } = useProjects()
  // Load all tasks for the depends list; exclude the current task being edited
  const { data: allTasks = [] } = useTasks()
  const dependsCandidates = allTasks.filter((t) => t.id !== task?.id)

  const isPending = addTask.isPending || modifyTask.isPending

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      projectId: defaultProjectId ?? '',
      priority: 'none',
      due: '',
      estimateMinutes: '',
      tags: '',
      depends: [],
    },
  })

  // Sync form values when the dialog opens (edit mode) or is cleared (add mode)
  useEffect(() => {
    if (!open) return
    if (task) {
      reset({
        title: task.title,
        projectId: task.project_id ?? '',
        priority: task.priority,
        due: task.due ?? '',
        estimateMinutes:
          task.estimate_minutes != null ? String(task.estimate_minutes) : '',
        tags: task.tags.join(', '),
        depends: task.depends,
      })
    } else {
      reset({
        title: '',
        projectId: defaultProjectId ?? '',
        priority: 'none',
        due: '',
        estimateMinutes: '',
        tags: '',
        depends: [],
      })
    }
  }, [open, task, defaultProjectId, reset])

  // Watch the depends array so we can manage checkbox state
  const selectedDepends = watch('depends')

  function toggleDepend(id: string) {
    const current = selectedDepends ?? []
    if (current.includes(id)) {
      setValue('depends', current.filter((d) => d !== id))
    } else {
      setValue('depends', [...current, id])
    }
  }

  function onSubmit(values: FormValues) {
    // Validate + parse estimate
    const estResult = parseEstimate(values.estimateMinutes)
    if (estResult.error) {
      setError('estimateMinutes', { message: estResult.error })
      return
    }

    const tags = values.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (isEdit && task) {
      const updated: Task = {
        ...task,
        title: values.title,
        project_id: values.projectId || null,
        priority: values.priority,
        due: values.due || null,
        estimate_minutes: estResult.value ?? null,
        tags,
        depends: values.depends,
      }
      modifyTask.mutate(updated, {
        onSuccess: () => onOpenChange(false),
      })
    } else {
      addTask.mutate(
        {
          title: values.title,
          opts: {
            projectId: values.projectId || null,
            priority: values.priority,
            due: values.due || null,
            estimateMinutes: estResult.value ?? null,
            tags,
            depends: values.depends,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      )
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle} aria-describedby={undefined}>
          {/* Title */}
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {isEdit ? 'Edit task' : 'New task'}
          </Dialog.Title>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Title */}
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                {...register('title')}
                placeholder="Task title"
                style={inputStyle}
                autoFocus
              />
              {errors.title && (
                <p style={errorStyle}>{errors.title.message}</p>
              )}
            </div>

            {/* Project */}
            <div>
              <label style={labelStyle}>Project</label>
              <select
                {...register('projectId')}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                {...register('priority')}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {errors.priority && (
                <p style={errorStyle}>{errors.priority.message}</p>
              )}
            </div>

            {/* Due date */}
            <div>
              <label style={labelStyle}>Due date</label>
              <input
                type="date"
                {...register('due')}
                style={inputStyle}
              />
              {errors.due && (
                <p style={errorStyle}>{errors.due.message}</p>
              )}
            </div>

            {/* Estimate */}
            <div>
              <label style={labelStyle}>Estimate (minutes)</label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 30"
                {...register('estimateMinutes')}
                style={inputStyle}
              />
              {errors.estimateMinutes && (
                <p style={errorStyle}>{errors.estimateMinutes.message}</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input
                {...register('tags')}
                placeholder="e.g. frontend, bug, v2"
                style={inputStyle}
              />
            </div>

            {/* Dependencies */}
            {dependsCandidates.length > 0 && (
              <div>
                <label style={labelStyle}>Depends on</label>
                <div
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px 0',
                    background: 'var(--surface-2)',
                  }}
                >
                  {dependsCandidates.map((t) => {
                    const checked = (selectedDepends ?? []).includes(t.id)
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          color: 'var(--text)',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDepend(t.id)}
                          style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                        />
                        <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>
                          #{t.seq}
                        </span>
                        <span className="truncate" title={t.title}>{t.title}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <Dialog.Close asChild>
                <button
                  type="button"
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? 'Saving…' : isEdit ? 'Save' : 'Add task'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
