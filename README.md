# Quadro-Negro

Kanban local para planejamento visual com prioridade, labels, vencimento, checklist, drag-and-drop e historico por card.

## Funcionalidades

- Colunas: A Fazer · Em Progresso · Concluido
- Cards com prioridade, labels, vencimento, checklist e descricao
- Drag-and-drop entre colunas (HTML5)
- Filtros por texto, prioridade, label e pendencias/atrasadas
- Export/import JSON do board
- Activity log por card (mutacoes com timestamp)
- Regra automatica: ao mover para Concluido, checklist vai a 100%
- Persistencia em `localStorage`

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm test
```

## Estrutura

```
src/
  lib/board-core.js   # logica pura (testada)
  main.js             # UI
  style.css
tests/
  board-core.test.js
```

## CI

GitHub Actions: `npm ci` → `npm test` → `npm run build`

## Licenca

Uso interno / RivasCode-Ops
