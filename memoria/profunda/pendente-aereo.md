---
id: pendente-aereo
comunidade: profunda
titulo: Pendente Aéreo
tipo: conceito
dominio: atendimento-rsvp
sensibilidade: interno
tags: [pendencia, aereo, status]
nos: [papel-operador]
relacionados: [status-rsvp-e-aereo, cascata-logistica, sla-rsvp]
fonte: BASE_CONHECIMENTO/processos-slas-rsvp.md + RSVP40/sigaeventos/BUSINESS_RULES.md — aprovado por Rafael em 2026-06-11
atualizado_em: 2026-06-11
---

# Pendente Aéreo

**PENDENTE AEREO** é um status do grupo **PROCESSAMENTO** do fluxo aéreo (SIGA Eventos / LP,
tabela Pax, coluna `status_aereo`): pendência **interna** da operação — operador/agência
trabalhando na emissão do voo. Não é ação pendente do convidado.

## Não confundir com os três "pendentes" do glossário do aéreo

- **Pendente Convidado** — ainda não há aprovação da emissão por parte do convidado.
- **Pendente Cliente** — pendência do cliente final (ex.: aprovação de valor, voo fora da agenda do evento).
- **Pendente RSVP** — o aéreo da agência passou orientação (que não é nova opção de voo) via coluna
  "OBSERVAÇÕES DO AEREO PARA A I GO".

Taxonomia completa dos status em [[status-rsvp-e-aereo]].

## Efeitos cascata

O aéreo é a **primeira etapa** da [[cascata-logistica]] (`CONFIRMADO → AÉREO → TRANSFER →
HOSPEDAGEM → ACOMPANHANTE → UPLOAD → FINALIZADO`): pendência aérea segura transfer, hospedagem
e voucher. O atendimento acompanha até a resolução, dentro do [[sla-rsvp]].
