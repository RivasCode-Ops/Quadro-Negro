# Prova de Publicacao Local — Quadro-Negro

Objetivo: registrar evidencias de evolucao funcional local do projeto.

## Versao atual
- App: `Quadro-Negro`
- Versao local: `0.1.0-local-proof`
- Data de referencia: 2026-05-28

## Funcionalidades implementadas nesta entrega
- Kanban com colunas: A Fazer, Em Progresso, Concluido
- Card com:
  - titulo
  - descricao
  - prioridade (baixa, media, alta, critica)
  - labels
  - vencimento
  - checklist
- Filtros:
  - texto
  - prioridade
  - label
  - modo (todas, abertas, atrasadas)
- Persistencia local em `localStorage`
- Exportacao e importacao do board em JSON
- Bloco visivel de prova no app:
  - versao
  - data de geracao
  - quantidade de tarefas
  - ultima atualizacao
  - release notes

## Como validar localmente
```bash
npm install
npm run dev
```

Abrir `http://localhost:5173` e conferir:
1. Bloco "Prova de Publicacao Local" visivel.
2. Criacao de tarefas com prioridade/prazo/labels/checklist.
3. Filtros alterando a visualizacao.
4. Exportar JSON e importar novamente com os mesmos cards.

## Evidencia de build
```bash
npm run build
```

Resultado esperado: build finalizada sem erros.
