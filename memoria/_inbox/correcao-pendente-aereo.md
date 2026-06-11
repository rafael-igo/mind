---
id: correcao-pendente-aereo
comunidade: profunda
titulo: Correção — "pendente aéreo" tem definição oficial (substitui o provisório)
tipo: conceito
dominio: atendimento-rsvp
sensibilidade: interno
tags: [pendente-aereo, aereo, status, correcao]
nos: [atendimento-rsvp]
relacionados: [pendente-aereo, status-rsvp-e-aereo]
fonte: BASE_CONHECIMENTO/processos-slas-rsvp.md + RSVP40/sigaeventos/BUSINESS_RULES.md
atualizado_em: 2026-06-11
---

# Correção do conceito "pendente aéreo"

O doc [[pendente-aereo]] da memória profunda está marcado como provisório. A definição oficial:

**PENDENTE AEREO** é um status do grupo **PROCESSAMENTO** do fluxo aéreo (sistema SIGA/LP):
processamento **interno** da operação — operador/agência trabalhando na emissão. Não é ação do convidado.

Não confundir com os três "pendentes" do glossário do aéreo:
- **Pendente Convidado** — falta aprovação da emissão pelo convidado;
- **Pendente Cliente** — pendência do cliente final (aprovação de valor, voo fora da agenda);
- **Pendente RSVP** — orientação da agência via coluna "OBSERVAÇÕES DO AEREO PARA A I GO".

**Ao aprovar:** consolidar este conteúdo em [[pendente-aereo]] (profunda) e remover a marca de provisório.
Sistemas que registram: SIGA Eventos / LP (tabela Pax, coluna status_aereo). Efeitos cascata:
o aéreo é a 1ª etapa da [[cascata-logistica]] — pendência aérea segura transfer/hospedagem/voucher.
