import './style.css'
import {
  APP_VERSION,
  COLUMNS,
  PRIORITIES,
  RELEASE_KEY,
  STORAGE_KEY,
  createTask,
  deleteTaskFromState,
  dueStatus,
  exportBoardPayload,
  loadTasksFromStorage,
  matchesFilters,
  moveTaskInState,
  normalizeTasks,
  parseImportPayload,
  saveTasksToStorage,
  setTaskStatus,
  toggleChecklistInState,
} from './lib/board-core.js'

const RELEASE_NOTES = [
  'Kanban com persistencia local e filtros avancados.',
  'Drag-and-drop entre colunas.',
  'Activity log por card e regra auto ao concluir.',
  'Testes Vitest + CI GitHub Actions.',
]

const app = document.querySelector('#app')
let state = normalizeTasks(loadTasksFromStorage((k) => localStorage.getItem(k)))
let filters = { query: '', priority: 'todas', label: '', mode: 'all' }
let dragTaskId = null
const releaseProof = loadReleaseProof()

app.innerHTML = `
  <main class="container">
    <header class="header">
      <h1>Quadro Negro</h1>
      <p>Evolucao funcional: planejamento visual com sinais de prioridade e prazo.</p>
    </header>

    <section class="composer">
      <input id="taskTitle" type="text" maxlength="120" placeholder="Nova tarefa..." />
      <select id="taskPriority">
        <option value="media">Prioridade: media</option>
        <option value="baixa">Prioridade: baixa</option>
        <option value="alta">Prioridade: alta</option>
        <option value="critica">Prioridade: critica</option>
      </select>
      <input id="taskDueDate" type="date" title="Vencimento" />
      <input id="taskLabels" type="text" maxlength="120" placeholder="labels: produto,cliente" />
      <input id="taskChecklist" type="text" maxlength="200" placeholder="Checklist: item1; item2" />
      <textarea id="taskDescription" maxlength="400" placeholder="Descricao (opcional)"></textarea>
      <button id="addTaskBtn" type="button">Adicionar</button>
    </section>

    <section class="toolbar">
      <input id="filterQuery" type="text" placeholder="Buscar tarefa..." />
      <select id="filterPriority">
        <option value="todas">Prioridade: todas</option>
        <option value="baixa">Baixa</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="critica">Critica</option>
      </select>
      <input id="filterLabel" type="text" placeholder="Filtrar label..." />
      <select id="filterMode">
        <option value="all">Modo: todas</option>
        <option value="open">Somente abertas</option>
        <option value="overdue">Somente atrasadas</option>
      </select>
      <button id="exportBtn" type="button">Exportar JSON</button>
      <button id="importBtn" type="button">Importar JSON</button>
      <input id="importInput" type="file" accept="application/json" hidden />
    </section>

    <section class="proof">
      <h2>Prova de Publicacao Local</h2>
      <p><strong>Versao:</strong> ${APP_VERSION}</p>
      <p><strong>Gerado em:</strong> ${escapeHtml(releaseProof.generatedAt)}</p>
      <p><strong>Tarefas no board:</strong> <span id="proofTasksCount">0</span></p>
      <p><strong>Ultima atualizacao:</strong> <span id="proofUpdatedAt">${escapeHtml(releaseProof.lastUpdate)}</span></p>
      <details>
        <summary>Release notes locais</summary>
        <ul>${RELEASE_NOTES.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </details>
    </section>

    <section class="board">
      ${COLUMNS.map((col) => renderColumn(col)).join('')}
    </section>
  </main>
`

document.querySelector('#addTaskBtn')?.addEventListener('click', onAddTask)
document.querySelector('#taskTitle')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onAddTask()
})
document.querySelector('#filterQuery')?.addEventListener('input', (e) => {
  if (!(e.target instanceof HTMLInputElement)) return
  filters.query = e.target.value.trim().toLowerCase()
  renderBoard()
})
document.querySelector('#filterPriority')?.addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLSelectElement)) return
  filters.priority = e.target.value
  renderBoard()
})
document.querySelector('#filterLabel')?.addEventListener('input', (e) => {
  if (!(e.target instanceof HTMLInputElement)) return
  filters.label = e.target.value.trim().toLowerCase()
  renderBoard()
})
document.querySelector('#filterMode')?.addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLSelectElement)) return
  filters.mode = e.target.value
  renderBoard()
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
renderBoard()

function renderColumn(column) {
  return `
    <article class="column" data-col="${column.id}">
      <h2>${column.title}</h2>
      <div class="cards drop-zone" data-col="${column.id}" id="col-${column.id}"></div>
    </article>
  `
}

function renderBoard() {
  document.querySelector('#proofTasksCount').textContent = String(state.length)
  document.querySelector('#proofUpdatedAt').textContent = loadReleaseProof().lastUpdate

  for (const column of COLUMNS) {
    const container = document.querySelector(`#col-${column.id}`)
    if (!container) continue
    const tasks = state.filter((t) => t.status === column.id && matchesFilters(t, filters))
    container.innerHTML = tasks.length
      ? tasks.map((t) => renderTask(t, column.id)).join('')
      : `<p class="empty">Sem tarefas</p>`
  }
  bindCardDrag()
}

function renderTask(task, status) {
  const index = COLUMNS.findIndex((col) => col.id === status)
  const due = dueStatus(task.dueDate)
  const labels = task.labels?.length ? task.labels.map((l) => `<span class="label">#${escapeHtml(l)}</span>`).join('') : ''
  const checklistDone = (task.checklist || []).filter((i) => i.done).length
  const checklistTotal = (task.checklist || []).length
  const activity = (task.activity || []).slice(-5).reverse()

  return `
    <div class="card" draggable="true" data-task-id="${task.id}">
      <div class="meta-row">
        <span class="priority priority-${task.priority}">${escapeHtml(task.priority)}</span>
        <span class="due due-${due.className}">${escapeHtml(due.label)}</span>
      </div>
      <p class="title">${escapeHtml(task.title)}</p>
      ${task.description ? `<p class="description">${escapeHtml(task.description)}</p>` : ''}
      ${labels ? `<div class="labels">${labels}</div>` : ''}
      ${
        checklistTotal
          ? `<details class="checklist">
              <summary>Checklist ${checklistDone}/${checklistTotal}</summary>
              ${(task.checklist || [])
                .map(
                  (item) => `<label class="check-item">
                    <input type="checkbox" data-action="toggle-check" data-id="${task.id}" data-checkid="${item.id}" ${item.done ? 'checked' : ''} />
                    <span>${escapeHtml(item.text)}</span>
                  </label>`,
                )
                .join('')}
            </details>`
          : ''
      }
      ${
        activity.length
          ? `<details class="activity">
              <summary>Historico (${activity.length})</summary>
              <ul class="activity-list">
                ${activity
                  .map(
                    (a) =>
                      `<li><time>${escapeHtml(formatDateTime(new Date(a.at)))}</time> ${escapeHtml(a.field)}: ${escapeHtml(String(a.oldValue ?? '—'))} → ${escapeHtml(String(a.newValue ?? '—'))}</li>`,
                  )
                  .join('')}
              </ul>
            </details>`
          : ''
      }
      <div class="actions">
        <button data-action="left" data-id="${task.id}" ${index > 0 ? '' : 'disabled'}>◀</button>
        <button data-action="right" data-id="${task.id}" ${index < COLUMNS.length - 1 ? '' : 'disabled'}>▶</button>
        <button data-action="delete" data-id="${task.id}" class="danger">Excluir</button>
      </div>
    </div>
  `
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

function bindCardDrag() {
  document.querySelectorAll('.card[draggable]').forEach((card) => {
    card.addEventListener('dragstart', (e) => e.stopPropagation())
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
  renderBoard()
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

function formatDateTime(value) {
  return value.toLocaleString('pt-BR')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
