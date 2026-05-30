export const STORAGE_KEY = 'quadro-negro.tasks.v1'
export const RELEASE_KEY = 'quadro-negro.release.v1'
export const APP_VERSION = '0.2.0'

export const COLUMNS = [
  { id: 'todo', title: 'A Fazer' },
  { id: 'doing', title: 'Em Progresso' },
  { id: 'done', title: 'Concluido' },
]

export const PRIORITIES = ['baixa', 'media', 'alta', 'critica']

export function normalizeTasks(tasks) {
  return tasks.map((task) => ({
    id: task.id,
    title: String(task.title || '').trim(),
    description: String(task.description || '').trim(),
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'media',
    labels: Array.isArray(task.labels) ? task.labels.map((item) => String(item).toLowerCase()) : [],
    dueDate: String(task.dueDate || ''),
    checklist: Array.isArray(task.checklist)
      ? task.checklist
          .filter((item) => item?.id && item?.text)
          .map((item) => ({ id: String(item.id), text: String(item.text), done: Boolean(item.done) }))
      : [],
    status: COLUMNS.some((col) => col.id === task.status) ? task.status : 'todo',
    activity: Array.isArray(task.activity)
      ? task.activity.filter((a) => a?.at && a?.field).slice(-50)
      : [],
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
  }))
}

export function appendActivity(task, entry, now = new Date().toISOString()) {
  const record = {
    id: entry.id || crypto.randomUUID(),
    at: now,
    field: entry.field,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
  }
  return {
    ...task,
    activity: [...(task.activity || []), record].slice(-50),
    updatedAt: now,
  }
}

/** Regra v1: ao mover para Concluido, marcar checklist 100% */
export function applyDoneAutomation(task) {
  if (task.status !== 'done' || !task.checklist?.length) return task
  if (task.checklist.every((item) => item.done)) return task
  return {
    ...task,
    checklist: task.checklist.map((item) => ({ ...item, done: true })),
  }
}

export function setTaskStatus(tasks, taskId, newStatus, now = new Date().toISOString()) {
  return tasks.map((task) => {
    if (task.id !== taskId) return task
    const oldStatus = task.status
    if (oldStatus === newStatus) return task
    let updated = appendActivity(
      { ...task, status: newStatus },
      { field: 'status', oldValue: oldStatus, newValue: newStatus },
      now,
    )
    updated = applyDoneAutomation(updated)
    if (updated.checklist !== task.checklist && newStatus === 'done') {
      updated = appendActivity(
        updated,
        { field: 'checklist', oldValue: 'parcial', newValue: '100% (auto)' },
        now,
      )
    }
    return updated
  })
}

export function moveTaskInState(tasks, taskId, direction) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return tasks
  const index = COLUMNS.findIndex((col) => col.id === task.status)
  const nextIndex = Math.max(0, Math.min(COLUMNS.length - 1, index + direction))
  const newStatus = COLUMNS[nextIndex].id
  return setTaskStatus(tasks, taskId, newStatus)
}

export function createTask(input, id = crypto.randomUUID(), now = new Date().toISOString()) {
  const title = String(input.title || '').trim()
  if (!title) return null
  const labels = (input.labels || [])
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
  const checklist = (input.checklist || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((text) => ({ id: crypto.randomUUID(), text, done: false }))

  return {
    id,
    title,
    description: String(input.description || '').trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'media',
    labels,
    dueDate: String(input.dueDate || ''),
    checklist,
    activity: [{ id: crypto.randomUUID(), at: now, field: 'created', oldValue: null, newValue: title }],
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  }
}

export function deleteTaskFromState(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId)
}

export function toggleChecklistInState(tasks, taskId, checkId, now = new Date().toISOString()) {
  if (!checkId) return tasks
  return tasks.map((task) => {
    if (task.id !== taskId) return task
    const item = (task.checklist || []).find((c) => c.id === checkId)
    if (!item) return task
    const newDone = !item.done
    const checklist = (task.checklist || []).map((c) =>
      c.id === checkId ? { ...c, done: newDone } : c,
    )
    return appendActivity(
      { ...task, checklist },
      { field: 'checklist', oldValue: item.done, newValue: newDone },
      now,
    )
  })
}

export function matchesFilters(task, filters) {
  if (filters.query) {
    const haystack = `${task.title} ${task.description} ${(task.labels || []).join(' ')}`.toLowerCase()
    if (!haystack.includes(filters.query)) return false
  }
  if (filters.priority !== 'todas' && task.priority !== filters.priority) return false
  if (filters.label && !(task.labels || []).some((label) => label.includes(filters.label))) return false
  if (filters.mode === 'open' && task.status === 'done') return false
  if (filters.mode === 'overdue' && !isOverdue(task.dueDate) && task.status !== 'done') return false
  return true
}

export function isOverdue(dueDate, now = new Date()) {
  if (!dueDate) return false
  const due = new Date(`${dueDate}T23:59:59`)
  return due < now
}

export function dueStatus(dueDate, now = new Date()) {
  if (!dueDate) return { className: 'none', label: 'sem prazo' }
  const due = new Date(`${dueDate}T23:59:59`)
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { className: 'overdue', label: `atrasada (${Math.abs(diffDays)}d)` }
  if (diffDays <= 2) return { className: 'warning', label: `vence em ${diffDays}d` }
  return { className: 'ok', label: `vence em ${diffDays}d` }
}

export function exportBoardPayload(tasks, meta = {}) {
  return {
    app: 'quadro-negro',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    ...meta,
  }
}

export function parseImportPayload(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!Array.isArray(parsed.tasks)) throw new Error('Arquivo invalido')
  return normalizeTasks(parsed.tasks)
}

export function loadTasksFromStorage(getItem, key = STORAGE_KEY) {
  try {
    const raw = getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((task) => task?.id && task?.title && task?.status)
  } catch {
    return []
  }
}

export function saveTasksToStorage(setItem, tasks, key = STORAGE_KEY) {
  setItem(key, JSON.stringify(tasks))
}
