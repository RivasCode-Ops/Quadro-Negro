import { COLUMNS, dueStatus, matchesFilters } from './board-core.js'

export const RELEASE_NOTES = [
  'Kanban com persistencia local e filtros avancados.',
  'Drag-and-drop entre colunas.',
  'Activity log por card e regra auto ao concluir.',
  'Testes Vitest + CI GitHub Actions.',
]

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatDateTime(value) {
  return value.toLocaleString('pt-BR')
}

export function buildAppShell({ appVersion, releaseProof }) {
  return `
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
      <p><strong>Versao:</strong> ${appVersion}</p>
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
}

export function renderColumn(column) {
  return `
    <article class="column" data-col="${column.id}">
      <h2>${column.title}</h2>
      <div class="cards drop-zone" data-col="${column.id}" id="col-${column.id}"></div>
    </article>
  `
}

export function renderBoard(state, filters, loadReleaseProof) {
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
}

export function renderTask(task, status) {
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

export function bindCardDrag() {
  document.querySelectorAll('.card[draggable]').forEach((card) => {
    card.addEventListener('dragstart', (e) => e.stopPropagation())
  })
}
