import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeTasks,
  matchesFilters,
  exportBoardPayload,
  parseImportPayload,
  setTaskStatus,
  applyDoneAutomation,
  createTask,
  loadTasksFromStorage,
  saveTasksToStorage,
  STORAGE_KEY,
  isOverdue,
} from '../src/lib/board-core.js'

const sampleTask = {
  id: 't1',
  title: 'Deploy',
  description: 'Subir producao',
  priority: 'alta',
  labels: ['produto'],
  dueDate: '2026-01-01',
  checklist: [{ id: 'c1', text: 'Build', done: false }],
  status: 'todo',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
}

describe('normalizeTasks', () => {
  it('normaliza campos e defaults', () => {
    const [task] = normalizeTasks([{ ...sampleTask, priority: 'invalido', activity: [] }])
    expect(task.priority).toBe('media')
    expect(task.labels).toEqual(['produto'])
    expect(task.activity).toEqual([])
  })
})

describe('matchesFilters', () => {
  it('filtra por texto, prioridade e label', () => {
    const filters = { query: 'deploy', priority: 'alta', label: 'prod', mode: 'all' }
    expect(matchesFilters(normalizeTasks([sampleTask])[0], filters)).toBe(true)
    expect(matchesFilters(normalizeTasks([sampleTask])[0], { ...filters, query: 'xyz' })).toBe(false)
  })

  it('filtra somente abertas', () => {
    const done = { ...sampleTask, status: 'done' }
    expect(matchesFilters(normalizeTasks([done])[0], { query: '', priority: 'todas', label: '', mode: 'open' })).toBe(
      false,
    )
  })
})

describe('export/import JSON', () => {
  it('roundtrip preserva tarefas', () => {
    const tasks = normalizeTasks([sampleTask])
    const payload = exportBoardPayload(tasks)
    const imported = parseImportPayload(JSON.stringify(payload))
    expect(imported[0].title).toBe('Deploy')
    expect(imported[0].labels).toEqual(['produto'])
  })

  it('rejeita payload invalido', () => {
    expect(() => parseImportPayload('{}')).toThrow('Arquivo invalido')
  })
})

describe('localStorage persistencia', () => {
  let store

  beforeEach(() => {
    store = new Map()
  })

  it('salva e carrega tarefas', () => {
    const tasks = normalizeTasks([sampleTask])
    saveTasksToStorage((k, v) => store.set(k, v), tasks)
    const loaded = loadTasksFromStorage((k) => store.get(k) ?? null)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('t1')
    expect(store.has(STORAGE_KEY)).toBe(true)
  })
})

describe('automacao ao concluir', () => {
  it('marca checklist 100% ao mover para done', () => {
    const tasks = normalizeTasks([sampleTask])
    const [result] = setTaskStatus(tasks, 't1', 'done', '2026-05-30T12:00:00.000Z')
    expect(result.status).toBe('done')
    expect(result.checklist.every((c) => c.done)).toBe(true)
    expect(result.activity.some((a) => a.field === 'checklist')).toBe(true)
  })

  it('applyDoneAutomation isolado', () => {
    const task = normalizeTasks([{ ...sampleTask, status: 'done' }])[0]
    const updated = applyDoneAutomation(task)
    expect(updated.checklist[0].done).toBe(true)
  })
})

describe('createTask', () => {
  it('cria tarefa com activity inicial', () => {
    const task = createTask(
      { title: 'Nova', priority: 'critica', labels: ['A'], checklist: ['x'] },
      'id-1',
      '2026-05-30T10:00:00.000Z',
    )
    expect(task?.title).toBe('Nova')
    expect(task?.activity[0].field).toBe('created')
  })

  it('retorna null sem titulo', () => {
    expect(createTask({ title: '  ' })).toBeNull()
  })
})

describe('isOverdue', () => {
  it('detecta atraso', () => {
    expect(isOverdue('2020-01-01', new Date('2026-05-30'))).toBe(true)
    expect(isOverdue('', new Date('2026-05-30'))).toBe(false)
  })
})
