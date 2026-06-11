---
projeto: Mind
documento: Memória — comunidades e Motor de Memória (mind-ingestor)
status: fundação (v0 — implementado e testado)
data_consolidacao: 2026-06-11
---

# Mind — Memória em comunidades + Motor de Memória

## A pasta `memoria/` É o cofre Obsidian

Não há sincronização: o Obsidian abre `memoria/` como vault e edita os mesmos `.md` que o
`carregarMemoria()` lê. As notas usam frontmatter (template em `memoria/_template.md`) e
ligações `[[id]]` — matriz de conhecimento, não RAG puro.

## Comunidades (camadas de memória, metáfora cerebral)

| Pasta | Comunidade | Papel | Como entra |
|---|---|---|---|
| `memoria/_inbox/` | pré-memória | aguarda aprovação (**freio**) | `ingerir_documento` / `consolidar` |
| `memoria/recente/` | episódica | chat da Mind + notas rápidas | automático (`capturar_chat`/`capturar_nota`) |
| `memoria/profunda/` | semântica | conhecimento consolidado/curado | só via `aprovar` (decisão humana) |

- Prefixo `_` (arquivos e pastas) é **invisível para a Mind** — por isso o `_inbox/` e as
  notas-hub `_Comunidade — *.md` não contaminam as respostas.
- O `core.ts` carrega as subpastas como comunidades (`DocMemoria.comunidade`); a raiz continua
  funcionando (comunidade `raiz`) e `MIND_MEMORIA_EXTRA` também.
- No Obsidian, `.obsidian/graph.json` colore cada comunidade no grafo; as notas-hub agrupam
  os membros visualmente.

## Motor de Memória — mind-ingestor (MCP híbrido)

Código: `/Users/rafamacpro/Projetos/GIT-RAFAEL/mcp-servers/mind-ingestor/`
Duas portas de entrada sobre o mesmo núcleo:

- **MCP stdio** — registrado no `.mcp.json` deste repo (Claude Code usa como tool).
- **API HTTP** — `uvicorn api:app --port 4180`; o mind-web manda cada troca de chat pra cá
  (`MIND_INGESTOR_URL` no `.env`; fire-and-forget, nunca trava a fala).

Conversão **híbrida**: markitdown (determinístico, PDF/DOCX/XLSX/PPTX/HTML) + curadoria LLM
opcional via igo-ai-gateway (`/v1/batch`, chave `tnt_`) que sugere tipo, domínio,
**sensibilidade**, tags e `relacionados`. Modelos: curadoria = `claude-haiku-4-5` (tarefa
pequena); consolidação = `claude-sonnet-4-6`.

Ciclo (como o cérebro consolida durante o sono):

```
documento/PDF ──ingerir──▶ _inbox ──aprovar (freio)──▶ profunda
chat da Mind ──capturar──▶ recente ──consolidar──▶ proposta no _inbox ──aprovar──▶ profunda
                                      validar_padrao mantém o frontmatter no padrão
```

`consolidar` agrupa a memória recente por domínio e propõe UM doc consolidado — sempre via
`_inbox`, nunca direto: memória curada, não inventada.

## Riscos mapeados

- **Ruído do chat:** capturas vão para `recente/` (episódica) e só viram conhecimento
  permanente via consolidação + aprovação.
- **RAG vetorial (fase 2):** quando houver embeddings, o filtro `podeVer()` continua sendo
  aplicado DEPOIS da busca — similaridade não pode vazar doc confidencial.
- **PDF escaneado:** markitdown não faz OCR; fallback futuro = LLM multimodal via gateway.

Ver também: [Arquitetura](01-ARQUITETURA.md) · [Plano de Arranque](03-PLANO-DE-ARRANQUE.md)
