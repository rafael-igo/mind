---
id: status-rsvp-e-aereo
comunidade: profunda
titulo: Status RSVP e Aéreo — taxonomia oficial
tipo: regra
dominio: atendimento-rsvp
sensibilidade: interno
tags: [status, rsvp, aereo, state-machine]
nos: [atendimento-rsvp]
relacionados: [pendente-aereo, sla-rsvp]
fonte: RSVP40/workspaces/sigaeventos/BUSINESS_RULES.md + lp-api/BUSINESS_RULES.md + BASE_CONHECIMENTO/processos-slas-rsvp.md
atualizado_em: 2026-06-11
---

# Status RSVP e Aéreo — taxonomia oficial

## Status de presença (6 grupos)

| Grupo | Cor | Exemplos | Significado |
|---|---|---|---|
| PENDENTES | laranja | PENDENTE, ADIADO, STANDBY, RETORNO, PENDENTE LP | aguardando ação do convidado |
| CONFIRMADOS | verde | CONFIRMADO, VIP, STAFF, CREDENCIADO, CONFIRMADO_AGUARDANDO_UPLOAD | presença confirmada (logística pode estar pendente) |
| EM_ANALISE | azul | EM ANALISE, PENDENTE_APROVACAO, ANALISE_COTA | processamento interno |
| CANCELADOS | vermelho | CANCELADO, RECUSOU, NO SHOW, SUBSTITUIDO | terminal — não participa |
| PRAZO_VENCIDO | cinza | PRAZO VENCIDO, SEM RESPOSTA, EXPIRADO | não respondeu no prazo — exige ação |
| FINALIZADOS | roxo | FINALIZADO, CONCLUIDO | fluxo encerrado |

## Status aéreo (5 grupos funcionais)

| Grupo | Status | Quem atua |
|---|---|---|
| PENDENTE CONVIDADO | PENDENTE CONVIDADO, NOVA OPCAO DE VOO, SOLICITA CONTATO | convidado (LP) ou operador (ligação) |
| PROCESSAMENTO | **PENDENTE AEREO**, PENDENTE AGENCIA, PENDENTE RSVP, EM EMISSAO, AEREO_COTAR | operador / agência |
| OK | EMITIDO, REEMITIDO, SEM AEREO, DISPENSOU AEREO, VIRTUAL | encerrado |
| PROBLEMA | CANCELADO, VOO_CANCELADO, REEMBOLSO_SOLICITADO, DUPLICIDADE | operador / agência |
| BACKUP | LISTA DE ESPERA AEREO | operador |

## Os três "pendentes" do aéreo (glossário oficial, processos-slas-rsvp.md)

- **Pendente Convidado** — ainda não há aprovação da emissão por parte do convidado.
- **Pendente Cliente** — pendência do cliente final (ex.: aprovação de valor, voo fora da agenda do evento).
- **Pendente RSVP** — o aéreo da agência passou orientação (que não é nova opção de voo) via coluna "OBSERVAÇÕES DO AEREO PARA A I GO".

## Transições (state machine, lp-api)

PENDENTE → CONFIRMADO|CANCELADO · CONFIRMADO → ...PENDENTE_CARTA|AGUARDANDO_UPLOAD|FINALIZADO|CANCELADO ·
EM_ANALISE → CONFIRMADO|REJEITADO|CANCELADO · CANCELADO → (terminal) · PRAZO_VENCIDO → PENDENTE|CANCELADO
