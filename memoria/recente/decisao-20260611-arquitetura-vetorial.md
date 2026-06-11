---
id: decisao-20260611-arquitetura-vetorial
comunidade: recente
titulo: Decisão — independência do studio, vetores com Ollama+pgvector, só Claude
tipo: decisao
dominio: mind-plataforma
sensibilidade: interno
tags: [decisao, arquitetura, vetor, ollama, studio, claude]
nos: [mind-plataforma, motor-memoria-vetorial, ollama-local, studio-pecas, gateway-mind]
relacionados: [sla-rsvp]
fonte: decisão do Rafael no chat de 11/jun/2026
atualizado_em: 2026-06-11
---

# Decisão de arquitetura (Rafael, 11/jun/2026)

1. **A Mind é independente do IGO AI Studio.** O studio (RSVP40) "era para ser o Mind, mas não
   deu" — fica como **banco de peças**: aproveita-se o padrão de chunking (1000 tokens, overlap
   200), o contrato de busca semântica do `mcp-knowledge` e os health-checks. Nunca como dependência.
2. **Vetorização com Ollama local** (modelo `nomic-embed-text`), **não GPT/OpenAI** — "usar o
   Claude e não mais o GPT". A máquina do Ollama **liga sob demanda**: a Mind monitora a
   disponibilidade e **degrada para busca lexical** quando ele está desligado (nunca trava).
3. **Vetores no pgvector** do mesmo Postgres do gateway da Mind (sem Qdrant, sem serviço novo).
   Regra inegociável: `podeVer()` filtra **depois** da busca vetorial — similaridade não vaza
   documento confidencial.
4. **Canal Claude automático, decidido pelo orquestrador/gateway**: fala e cognição usam SEMPRE
   a API via gateway (porta 4101 — auditoria, budget, guardrails). Tarefas de código/arquivo são
   candidatas a um futuro **motor-executor** headless (`claude -p` no terminal), acionado pelo
   orquestrador conforme o tipo de tarefa.
5. **Orquestradores (de-para)**: o router do igo-ai-gateway vence o orchestrator do studio —
   detalhes em `docs/06-DEPARA-ORQUESTRADORES.md`.
