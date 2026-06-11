---
id: papel-operador
titulo: Operador de Atendimento RSVP
tipo: papel
dominio: atendimento-rsvp
sensibilidade: interno
tags: [atendimento, operacao]
nos: [papel-operador]
relacionados: [sla-rsvp, pendente-aereo]
fonte: chat de concepção (07/jun) — a validar/expandir com Rafael
atualizado_em: 2026-06-11
---

# Operador de Atendimento RSVP

Linha de frente da jornada do convidado. Recebe o contato pelos canais (ligação, WhatsApp,
email), identifica o convidado/evento, verifica e atualiza o status, e segue o [[sla-rsvp]].

## O que faz
- Confirma presença, tira dúvidas e atualiza status do convidado.
- Registra pendências (ex.: [[pendente-aereo]]).
- Respeita os prazos do SLA; prioriza casos críticos.

## Cascata de escalonamento
Quando não resolve, **escala para o Consultor** → Especialista → Coordenador.

## A validar com Rafael
- Sistemas exatos que o operador usa.
- Checklist de abertura/fechamento de atendimento.
- Métricas que o operador acompanha.
