---
id: _mapa-memoria
titulo: "MAPA — Memória da Mind"
tipo: doc-dev
fonte: manual (cofre Obsidian)
atualizado_em: 2026-06-11
---

# 🗺️ Memória da Mind — comece aqui

Este cofre é a **memória curada** da Mind: tudo que está aqui (fora de `_inbox/`) é o que ela
pode afirmar com confiança. O que não está registrado, ela diz que não há registro.

## As camadas (comunidades)

| Camada | Pasta | O que é | Quem escreve |
|---|---|---|---|
| 🧠 [[_comunidade-profunda\|Profunda]] | `profunda/` | Memória **semântica** — conhecimento consolidado e curado | consolidação aprovada (freio) |
| ⚡ [[_comunidade-recente\|Recente]] | `recente/` | Memória **episódica** — capturas de chat, notas rápidas e `decisao-*` aprovadas no freio | mind-ingestor + freio da Mind |
| 📥 Inbox | `_inbox/` | **Pré-memória** — convertido pelo ingestor, aguardando aprovação. *Invisível para a Mind* | mind-ingestor |

Fluxo de consolidação: **chat/nota → `_inbox/` → aprovação → `recente/` → consolidação → `profunda/`**.
Toda escrita que "muda a verdade" passa pelo **freio** (propostas em `operacao/propostas/`, decide
quem tem rank ≥ 50); a decisão aprovada vira `recente/decisao-<proposta>.md`.

## Regras do cofre

- Todo documento segue o [[_template]] (frontmatter com `id`, `comunidade`, `sensibilidade`, `tags`, `nos`, `relacionados`).
- Ligações entre docs com `[[id-do-doc]]` — é a matriz de conhecimento, não pasta de arquivos.
- `sensibilidade` controla quem vê via Mind: publico < interno < restrito < confidencial.
- Arquivos com prefixo `_` são infraestrutura (hubs, template, mapa) — o ingestor mantém os hubs `_Comunidade — *.md`.

## Visão de grafo

Abra o **Graph view**: laranja = recente, verde = profunda, cinza = inbox, roxo = hubs.

## Pendências de curadoria

- [x] ~~Confirmar definição oficial de [[pendente-aereo]]~~ — consolidada em 11/jun (fontes: processos-slas-rsvp + RSVP40). Ver também [[status-rsvp-e-aereo]].
- [ ] **Oficializar** os valores de resposta do [[sla-rsvp]] (2h/8h/24h são proposta sua — a operação não tem SLA de resposta formalizado; entregáveis oficiais em [[sla-igo-oficial]]).
- [ ] Validar [[papeis-raci-rsvp]] e o ajuste dos papéis no grafo (Consultor executa, Especialista confere; novos: Solicita RSVP e Apoio).
