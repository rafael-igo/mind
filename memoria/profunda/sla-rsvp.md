---
id: sla-rsvp
comunidade: profunda
titulo: SLA de Atendimento RSVP
tipo: regra
dominio: atendimento-rsvp
sensibilidade: interno
tags: [sla, prazo, prioridade]
nos: [bloco-sla-rsvp, motor-sla]
relacionados: [papel-operador, sla-igo-oficial]
fonte: chat de concepção (07/jun) — proposta do Rafael a oficializar (não há SLA de resposta formalizado na operação)
atualizado_em: 2026-06-11
---

# SLA de Atendimento RSVP

Regras de prazo e prioridade. No produto é o **Motor de SLA** (determinístico): dada uma
lista/data, calcula prazo e prioridade.

> Nota (11/jun): estes valores de **resposta de atendimento** são **proposta a oficializar** —
> a operação não tem SLA de resposta formalizado (lacuna confirmada no RSVP40, futuro Task Engine).
> Os SLAs oficiais de **entregáveis** (dias úteis) estão em [[sla-igo-oficial]].

## Regras (proposta — a oficializar)
| Prioridade | Prazo | Gatilho |
|---|---|---|
| Crítica | 2h | evento em menos de 48h |
| Alta | 8h | evento em menos de 7 dias |
| Normal | 24h | demais casos |

- **Estouro de prazo:** sinalizar em vermelho. **Resolvido:** verde.
- Estouro de SLA é gatilho de **escalonamento** (ver [[papel-operador]]).

## Pergunta-teste do domínio
"Quais convidados estão estourando o SLA?" → orquestrador aciona o Motor de SLA (Fase 2).
