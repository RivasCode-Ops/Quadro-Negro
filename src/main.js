import './style.css'
import {
  APP_VERSION,
  RELEASE_KEY,
  createTask,
  deleteTaskFromState,
  exportBoardPayload,
  loadTasksFromStorage,
  moveTaskInState,
  normalizeTasks,
  parseImportPayload,
  saveTasksToStorage,
  setTaskStatus,
  toggleChecklistInState,
} from './lib/board-core.js'
import {
  RELEASE_NOTES,
  bindCardDrag,
  buildAppShell,
  formatDateTime,
  renderBoard,
} from './lib/board-ui.js'

const app = document.querySelector('#app')
let state = normalizeTasks(loadTasksFromStorage((k) => localStorage.getItem(k)))
let filters = { query: '', priority: 'todas', label: '', mode: 'all' }
let dragTaskId = null
const releaseProof = loadReleaseProof()

app.innerHTML = buildAppShell({ appVersion: APP_VERSION, releaseProof })

document.querySelector('#addTaskBtn')?.addEventListener('click', onAddTask)
document.querySelector('#taskTitle')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onAddTask()
})
document.querySelector('#filterQuery')?.addEventListener('input', (e) => {
  if (!(e.target instanceof HTMLInputElement)) return
  filters.query = e.target.value.trim().toLowerCase()
  paintBoard()
})
document.querySelector('#filterPriority')?.addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLSelectElement)) return
  filters.priority = e.target.value
  paintBoard()
})
document.querySelector('#filterLabel')?.addEventListener('input', (e) => {
  if (!(e.target instanceof HTMLInputElement)) return
  filters.label = e.target.value.trim().toLowerCase()
  paintBoard()
})
document.querySelector('#filterMode')?.addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLSelectElement)) return
  filters.mode = e.target.value
  paintBoard()
})
document.querySelector('#exportBtn')?.addEventListener('click', exportBoard)
document.querySelector('#importBtn')?.addEventListener('click', () => document.querySelector('#importInput')?.click())
document.querySelector('#importInput')?.addEventListener('change', onImportBoard)

app.addEventListener('click', (e) => {
  if (!(e.target instanceof HTMLElement)) return
  const action = e.target.dataset.action
  const taskId = e.target.dataset.id
  if (!action || !taskId) return
  if (action === 'left') state = moveTaskInState(state, taskId, -1)
  if (action === 'right') state = moveTaskInState(state, taskId, 1)
  if (action === 'delete') state = deleteTaskFromState(state, taskId)
  if (action === 'toggle-check') state = toggleChecklistInState(state, taskId, e.target.dataset.checkid)
  if (action === 'left' || action === 'right' || action === 'delete' || action === 'toggle-check') persistAndRender()
})

setupDragAndDrop()
paintBoard()

function paintBoard() {
  renderBoard(state, filters, loadReleaseProof)
  bindCardDrag()
}

function onAddTask() {
  const input = document.querySelector('#taskTitle')
  const priority = document.querySelector('#taskPriority')
  const dueDate = document.querySelector('#taskDueDate')
  const labelsInput = document.querySelector('#taskLabels')
  const checklistInput = document.querySelector('#taskChecklist')
  const descriptionInput = document.querySelector('#taskDescription')
  if (
    !(input instanceof HTMLInputElement) ||
    !(priority instanceof HTMLSelectElement) ||
    !(dueDate instanceof HTMLInputElement) ||
    !(labelsInput instanceof HTMLInputElement) ||
    !(checklistInput instanceof HTMLInputElement) ||
    !(descriptionInput instanceof HTMLTextAreaElement)
  )
    return

  const task = createTask({
    title: input.value,
    priority: priority.value,
    dueDate: dueDate.value,
    labels: labelsInput.value.split(','),
    checklist: checklistInput.value.split(';'),
    description: descriptionInput.value,
  })
  if (!task) return

  state = [task, ...state]
  input.value = ''
  labelsInput.value = ''
  checklistInput.value = ''
  descriptionInput.value = ''
  dueDate.value = ''
  priority.value = 'media'
  persistAndRender()
}

function setupDragAndDrop() {
  app.addEventListener('dragstart', (e) => {
    const card = e.target instanceof HTMLElement ? e.target.closest('.card') : null
    if (!card) return
    dragTaskId = card.dataset.taskId || null
    card.classList.add('dragging')
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', dragTaskId || '')
    }
  })
  app.addEventListener('dragend', (e) => {
    const card = e.target instanceof HTMLElement ? e.target.closest('.card') : null
    card?.classList.remove('dragging')
    document.querySelectorAll('.drop-zone').forEach((z) => z.classList.remove('drag-over'))
    dragTaskId = null
  })
  app.addEventListener('dragover', (e) => {
    const zone = e.target instanceof HTMLElement ? e.target.closest('.drop-zone') : null
    if (!zone) return
    e.preventDefault()
    zone.classList.add('drag-over')
  })
  app.addEventListener('dragleave', (e) => {
    const zone = e.target instanceof HTMLElement ? e.target.closest('.drop-zone') : null
    zone?.classList.remove('drag-over')
  })
  app.addEventListener('drop', (e) => {
    const zone = e.target instanceof HTMLElement ? e.target.closest('.drop-zone') : null
    if (!zone) return
    e.preventDefault()
    zone.classList.remove('drag-over')
    const col = zone.dataset.col
    const taskId = dragTaskId || e.dataTransfer?.getData('text/plain')
    if (!col || !taskId) return
    state = setTaskStatus(state, taskId, col)
    persistAndRender()
  })
}

function persistAndRender() {
  saveTasksToStorage((k, v) => localStorage.setItem(k, v), state)
  localStorage.setItem(
    RELEASE_KEY,
    JSON.stringify({
      version: APP_VERSION,
      generatedAt: releaseProof.generatedAt,
      lastUpdate: formatDateTime(new Date()),
      notes: RELEASE_NOTES,
    }),
  )
  paintBoard()
}

function exportBoard() {
  const payload = exportBoardPayload(state, { release: loadReleaseProof() })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quadro-negro-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function onImportBoard(event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || !target.files?.length) return
  try {
    state = parseImportPayload(await target.files[0].text())
    persistAndRender()
  } catch {
    alert('Nao foi possivel importar. Use um JSON exportado pelo Quadro Negro.')
  } finally {
    target.value = ''
  }
}

function loadReleaseProof() {
  try {
    const raw = localStorage.getItem(RELEASE_KEY)
    if (!raw) return defaultReleaseProof()
    const parsed = JSON.parse(raw)
    return {
      version: String(parsed.version || APP_VERSION),
      generatedAt: String(parsed.generatedAt || formatDateTime(new Date())),
      lastUpdate: String(parsed.lastUpdate || formatDateTime(new Date())),
      notes: Array.isArray(parsed.notes) ? parsed.notes : RELEASE_NOTES,
    }
  } catch {
    return defaultReleaseProof()
  }
}

function defaultReleaseProof() {
  const now = formatDateTime(new Date())
  return { version: APP_VERSION, generatedAt: now, lastUpdate: now, notes: RELEASE_NOTES }
}
