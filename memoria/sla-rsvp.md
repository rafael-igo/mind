---
id: sla-rsvp
titulo: SLA de Atendimento RSVP
tipo: regra
dominio: atendimento-rsvp
sensibilidade: interno
tags: [sla, prazo, prioridade]
nos: [bloco-sla-rsvp, motor-sla]
relacionados: [papel-operador]
fonte: chat de concepção (07/jun) — valores de exemplo, a validar com Rafael
atualizado_em: 2026-06-11
---

# SLA de Atendimento RSVP

Regras de prazo e prioridade. No produto vira o **Motor de SLA** (determinístico, .NET): dada uma
lista/data, calcula prazo e prioridade.

## Regras (exemplo — a validar)
| Prioridade | Prazo | Gatilho |
|---|---|---|
| Crítica | 2h | evento em menos de 48h |
| Alta | 8h | evento em menos de 7 dias |
| Normal | 24h | demais casos |

- **Estouro de prazo:** sinalizar em vermelho. **Resolvido:** verde.
- Estouro de SLA é gatilho de **escalonamento** (ver [[papel-operador]]).

## Pergunta-teste do domínio
"Quais convidados estão estourando o SLA?" → orquestrador aciona o Motor de SLA (Fase 2).
