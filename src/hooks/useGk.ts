/**
 * TanStack Query hooks over window.gk (the preload-bridge API).
 *
 * Query key factory (qk) + query hooks (useQuery) + mutation hooks (useMutation).
 * Optimistic updates for useStartTask / useCompleteTask patch / remove the
 * affected task from the cached ready[] and score[] lists before the server
 * round-trip so the UI feels instant; errors roll back to the snapshots.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { Task, Goal, Project } from '@core/models'
import type { AppConfig } from '@core/config'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const qk = {
  goals: ['goals'] as const,
  projects: (goalId?: string | null) => ['projects', goalId ?? null] as const,
  tasks: (projectId?: string | null, status?: string | null) =>
    ['tasks', projectId ?? null, status ?? null] as const,
  ready: ['ready'] as const,
  score: ['score'] as const,
  config: ['config'] as const,
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: qk.goals,
    queryFn: () => window.gk.listGoals(),
  })
}

export function useProjects(goalId?: string | null) {
  return useQuery<Project[]>({
    queryKey: qk.projects(goalId),
    queryFn: () => window.gk.listProjects(goalId),
  })
}

export function useTasks(projectId?: string | null, status?: string | null) {
  return useQuery<Task[]>({
    queryKey: qk.tasks(projectId, status),
    queryFn: () => window.gk.listTasks(projectId, status),
  })
}

export function useReady() {
  return useQuery<Task[]>({
    queryKey: qk.ready,
    queryFn: () => window.gk.ready(),
  })
}

export function useScore() {
  return useQuery<Task[]>({
    queryKey: qk.score,
    queryFn: () => window.gk.score(),
  })
}

export function useConfig() {
  return useQuery<AppConfig>({
    queryKey: qk.config,
    queryFn: () => window.gk.getConfig(),
  })
}

// ---------------------------------------------------------------------------
// Internal optimistic-update helpers
// ---------------------------------------------------------------------------

type TaskSnapshot = {
  ready: Task[] | undefined
  score: Task[] | undefined
  taskLists: [readonly unknown[], Task[]][]
}

/**
 * Patch every cached Task[] (ready, score, ['tasks', …]) by applying
 * `patchFn` to each array and return a snapshot for rollback.
 */
function applyOptimisticTaskPatch(
  queryClient: ReturnType<typeof useQueryClient>,
  patchFn: (tasks: Task[]) => Task[],
): TaskSnapshot {
  const prevReady = queryClient.getQueryData<Task[]>(qk.ready)
  const prevScore = queryClient.getQueryData<Task[]>(qk.score)

  // Collect all ['tasks', …] cache entries for patching + rollback
  const taskEntries = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] })

  if (prevReady) queryClient.setQueryData(qk.ready, patchFn(prevReady))
  if (prevScore) queryClient.setQueryData(qk.score, patchFn(prevScore))
  for (const [key, data] of taskEntries) {
    if (data) queryClient.setQueryData(key, patchFn(data))
  }

  return {
    ready: prevReady,
    score: prevScore,
    taskLists: taskEntries as [readonly unknown[], Task[]][],
  }
}

function rollbackTaskSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: TaskSnapshot,
) {
  if (snapshot.ready !== undefined) queryClient.setQueryData(qk.ready, snapshot.ready)
  if (snapshot.score !== undefined) queryClient.setQueryData(qk.score, snapshot.score)
  for (const [key, data] of snapshot.taskLists) {
    queryClient.setQueryData(key, data)
  }
}

/** Invalidates all queries that could be affected by a task mutation. */
function invalidateTaskRelated(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    queryClient.invalidateQueries({ queryKey: qk.ready }),
    queryClient.invalidateQueries({ queryKey: qk.score }),
    queryClient.invalidateQueries({ queryKey: qk.goals }),
  ])
}

// ---------------------------------------------------------------------------
// Task mutation hooks
// ---------------------------------------------------------------------------

export function useAddTask() {
  const queryClient = useQueryClient()
  return useMutation<
    Task,
    Error,
    {
      title: string
      opts?: {
        projectId?: string | null
        priority?: string
        due?: string | null
        estimateMinutes?: number | null
        tags?: string[]
        depends?: string[]
      }
    }
  >({
    mutationFn: ({ title, opts }) => window.gk.addTask(title, opts),
    onSuccess: () => invalidateTaskRelated(queryClient),
  })
}

export function useStartTask() {
  const queryClient = useQueryClient()
  return useMutation<Task | null, Error, string | number, TaskSnapshot>({
    mutationFn: (seq) => window.gk.startTask(seq),
    onMutate: async (seq) => {
      // Cancel in-flight fetches so they don't overwrite our optimistic patch
      await queryClient.cancelQueries({ queryKey: qk.ready })
      await queryClient.cancelQueries({ queryKey: qk.score })

      const snapshot = applyOptimisticTaskPatch(queryClient, (tasks) =>
        tasks.map((t) => (t.seq === Number(seq) ? { ...t, status: 'active' as const } : t)),
      )
      return snapshot
    },
    onError: (_err, _seq, ctx) => {
      if (ctx) rollbackTaskSnapshot(queryClient, ctx)
    },
    onSettled: () => invalidateTaskRelated(queryClient),
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  return useMutation<Task | null, Error, string | number, TaskSnapshot>({
    mutationFn: (seq) => window.gk.completeTask(seq),
    onMutate: async (seq) => {
      await queryClient.cancelQueries({ queryKey: qk.ready })
      await queryClient.cancelQueries({ queryKey: qk.score })

      // Remove the completed task from ready/score lists optimistically
      const snapshot = applyOptimisticTaskPatch(queryClient, (tasks) =>
        tasks.filter((t) => t.seq !== Number(seq)),
      )
      return snapshot
    },
    onError: (_err, _seq, ctx) => {
      if (ctx) rollbackTaskSnapshot(queryClient, ctx)
    },
    onSettled: () => invalidateTaskRelated(queryClient),
  })
}

export function useModifyTask() {
  const queryClient = useQueryClient()
  return useMutation<Task, Error, Task>({
    mutationFn: (task) => window.gk.modifyTask(task),
    onSuccess: () => invalidateTaskRelated(queryClient),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.gk.deleteTask(id),
    onSuccess: () => invalidateTaskRelated(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Goal mutation hooks
// ---------------------------------------------------------------------------

export function useAddGoal() {
  const queryClient = useQueryClient()
  return useMutation<
    Goal,
    Error,
    {
      title: string
      opts?: { description?: string; priority?: string; horizon?: string | null }
    }
  >({
    mutationFn: ({ title, opts }) => window.gk.addGoal(title, opts),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.goals }),
  })
}

export function useCompleteGoal() {
  const queryClient = useQueryClient()
  return useMutation<Goal | null, Error, string>({
    mutationFn: (id) => window.gk.completeGoal(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.goals }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.gk.deleteGoal(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.goals }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]),
  })
}

// ---------------------------------------------------------------------------
// Project mutation hooks
// ---------------------------------------------------------------------------

export function useAddProject() {
  const queryClient = useQueryClient()
  return useMutation<
    Project,
    Error,
    {
      title: string
      opts?: { goalId?: string | null; description?: string }
    }
  >({
    mutationFn: ({ title, opts }) => window.gk.addProject(title, opts),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: qk.goals }),
      ]),
  })
}

export function useCompleteProject() {
  const queryClient = useQueryClient()
  return useMutation<Project | null, Error, string>({
    mutationFn: (id) => window.gk.completeProject(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: qk.goals }),
      ]),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.gk.deleteProject(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: qk.goals }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: qk.ready }),
        queryClient.invalidateQueries({ queryKey: qk.score }),
      ]),
  })
}

// ---------------------------------------------------------------------------
// Config mutation hook
// ---------------------------------------------------------------------------

export function useSaveConfig() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, AppConfig>({
    mutationFn: (c) => window.gk.saveConfig(c),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.config }),
        queryClient.invalidateQueries({ queryKey: qk.ready }),
        queryClient.invalidateQueries({ queryKey: qk.score }),
      ]),
  })
}
