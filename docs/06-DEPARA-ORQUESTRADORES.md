---
projeto: Mind
documento: De-para dos orquestradores (gateway × studio × Mind) + canal Claude automático
data: 2026-06-11
decisao: Rafael — Mind independente do studio; studio é banco de peças
---

# De-para: os três "orquestradores"

São **camadas diferentes** — a comparação justa é por função:

| Função | igo-ai-gateway (router) | IGO AI Studio (orchestrator) | Mind (core.ts `orquestrar`) |
|---|---|---|---|
| O que orquestra | **chamadas LLM** (modelo, custo) | **execuções de agentes** (runs, filas, terminais) | **cognição** (rotear pergunta → memória/motor/freio) |
| Stack | Node/Express, Postgres | Python/FastAPI + Node relay + Vue | TypeScript no Next.js |
| Maturidade | **produção** (3 tenants, auditoria, budget, guardrails, hard-cap) | em construção (Fase 1/2) | espinha testada (Fases 0–4, 19/19) |
| Multi-tenant | sim (API key + budget por tenant) | não | n/a (permissão por usuário/nível) |
| Escolha de modelo | router determinístico (hint + task_type + allowed_models) | n/a (delega) | por nível de acesso (haiku→sonnet→opus→fable) |
| Observabilidade | audit log + custos por chamada | dashboard web (em construção) | resposta com modo/contexto + captura no ingestor |

## Veredito (decidido em 11/jun/2026)

**O router do gateway funciona melhor e fica.** O orchestrator do studio não entra como serviço —
a Mind é **independente do studio**. Do studio aproveitamos **peças**:

| Peça do studio | Onde entra na Mind |
|---|---|
| Chunker (1000 tokens, overlap 200, preserva headings) | `lib/memoria-vetorial.ts` (indexação) |
| Contrato do `mcp-knowledge` (`semantic_search(query, top_k, filtros)`) | assinatura da `buscarVetorial()` |
| Health-check de RAG (`rag_health_check`) | `/api/saude` (monitor Ollama/pgvector) |
| Padrão sync incremental por hash | indexador (re-embedda só o que mudou) |
| ExecutionQueue / TerminalSession | referência futura para o **motor-executor** |

## Canal Claude: automático, decidido pelo orquestrador

Avaliação API × terminal (Claude Code) × code:

| Canal | Uso na Mind | Quando |
|---|---|---|
| **API via gateway (4101)** | **canal padrão de produção** — fala, cognição, propostas | sempre que a Mind responde/raciocina (auditável, budget, modelo por nível) |
| **Terminal headless (`claude -p`)** | candidato a **motor-executor**: tarefas que mexem em código/arquivos do repo (ex.: gerar módulo, refatorar projeção) | futuro motor; o orquestrador decide pelo TIPO da tarefa (cognição→API; execução de código→executor), nunca o usuário |
| Claude Code interativo | desenvolvimento da própria Mind (como esta sessão) | manual, fora do runtime |

Regra: **a decisão de canal é do orquestrador/gateway, nunca manual** — mesmo princípio da escolha
de modelo por nível. Hoje só o canal API está ativo; o executor entra quando houver o primeiro
motor de código.

## Embeddings: Ollama local, monitorado

- Provedor: **Ollama** (`nomic-embed-text`, 768 dims) — sem OpenAI ("usar o Claude e não mais o GPT";
  como a Anthropic não tem API de embeddings, o local cobre essa função).
- A máquina do Ollama **liga sob demanda**: `ollamaDisponivel()` monitora; desligado ⇒ a Mind
  **degrada para busca lexical** sem erro, e o painel mostra o status.
- Vetores em **pgvector** no Postgres do mind-gateway (tabela `memoria_vetores`).
- Segurança: `podeVer()` filtra **depois** de qualquer busca (lexical ou vetorial).
