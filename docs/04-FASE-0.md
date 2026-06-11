---
projeto: Mind
documento: Fase 0 — Fundação esquelética (arranque)
status: em andamento — esqueleto criado, decisões a validar
data: 2026-06-11
---

# Fase 0 — Fundação esquelética

Esqueleto mínimo criado neste repositório. Conforme o acordo, eu (IA) lidero as definições; você
valida e corrige. As **duas decisões da fase** são o **schema do nó** e a **tabela de permissão**.

## Estrutura do repositório

```
Mind/
├── README.md
├── docs/                 # conceito, arquitetura, operação, plano, esta fase
├── grafo/                # FONTE DA VERDADE (JSON) — Mermaid será projeção disto
│   ├── schema/
│   │   ├── no.schema.json
│   │   └── aresta.schema.json
│   └── atendimento.json  # primeiro domínio real (papéis, SLA, cascata)
├── memoria/              # matriz de conhecimento (Markdown + frontmatter)
│   ├── _template.md
│   ├── papel-operador.md
│   ├── sla-rsvp.md
│   └── pendente-aereo.md
├── permissoes/
│   ├── niveis.json
│   └── usuarios.exemplo.json
├── motores/              # vazio — Motor de SLA entra na Fase 2 (.NET)
└── orquestrador/         # vazio — Fase 1
```

## Decisão 1 — Schema do nó (a validar)

Um nó tem: `id` (kebab-case estável), `tipo` (dominio | papel | motor | modulo | bloco-regra),
`titulo`, `descricao`, `dominio` (pai), `sensibilidade` (publico | interno | restrito |
confidencial), `status` (ideia | planejado | em-dev | ativo), `memoria` (docs ligados) e
`metadados` livres por tipo (ex.: o bloco SLA guarda suas regras dentro). Arestas são separadas
(`de`, `para`, `tipo`), no padrão normalizado — o Mermaid é gerado a partir daí (CQRS).

**Pergunta da fase:** os tipos de nó e de aresta cobrem o Atendimento? Falta algum campo (ex.:
dono/responsável, SLA próprio do nó)?

## Decisão 2 — Tabela de permissão (a validar)

Níveis por `rank`: operador (10) < consultor (20) < coordenador (30) < rh (40) < diretor (50) <
criador (100). Cada sensibilidade exige um rank mínimo (interno≥10, restrito≥30, confidencial≥50).
Tags especiais (ex.: `pessoas` → só RH) tratadas no orquestrador de input.

**Pergunta da fase:** esses 6 níveis bastam para começar? A regra rank + exceção por tag faz
sentido para o caso "lista de funcionários e salários = só RH/diretor"?

## Critério de teste da Fase 0 (definition of done)

> Carregar o grafo, ler um documento, e o sistema sabe **quem sou eu** e o **meu nível**.

Concretamente, um script mínimo deve: (1) ler `grafo/atendimento.json` e validar contra o schema;
(2) abrir um doc de `memoria/`; (3) dado um usuário de `usuarios.exemplo.json`, decidir se ele
pode ver um nó pela `sensibilidade`. Quando esse script rodar e acertar (criador vê o coordenador
restrito; operador não), a Fase 0 passou e abrimos a **Fase 1** (orquestrador mínimo).

## Pendência de domínio (sua)
- Confirmar a definição de **pendente aéreo** (é o doc do teste da Fase 1).
- Validar os valores do **SLA** (estão como exemplo).
