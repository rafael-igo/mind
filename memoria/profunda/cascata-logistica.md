---
id: cascata-logistica
comunidade: profunda
titulo: Cascata logística (imutável) e regras de patrocínio
tipo: regra
dominio: atendimento-rsvp
sensibilidade: interno
tags: [cascata, logistica, aereo, transfer, hospedagem, patrocinio]
nos: [atendimento-rsvp, controle-de-salas]
relacionados: [status-rsvp-e-aereo]
fonte: VBA-EXCEL/CLAUDE.md + RSVP40/workspaces/lp-api/BUSINESS_RULES.md + sigaeventos/PROJECT_RULES.md
atualizado_em: 2026-06-11
---

# Cascata logística (ordem obrigatória e imutável)

```
CONFIRMADO → AÉREO → TRANSFER → HOSPEDAGEM → ACOMPANHANTE → UPLOAD → FINALIZADO
```

Depois que o convidado (PAX) confirma, a jornada passa por cada etapa NESTA ordem — nunca pular.

## Condições de cada etapa (verificação de patrocínio — requisito contratual)

- **Aéreo**: `patro_aereo == "SIM"` **E** status aéreo em [PENDENTE CONVIDADO, NOVA OPCAO DE VOO, SOLICITA CONTATO]
- **Transfer**: pelo menos UM de 5 patrocínios de transfer == "SIM" (in/out, porta-porta, hotel-evento, pernoite, entre aeroportos)
- **Hospedagem**: `patro_hospedagem == "SIM"`
- **Acompanhante**: cota disponível e PAX principal
- **Upload**: fluxo PENDENTE_ARQUIVO → ARQUIVO_RECEBIDO → ARQUIVO_APROVADO (ou REJEITADO)

Abrir formulário de logística SEM patrocínio é violação contratual — o backend é o guardião.

## Hardcodes imutáveis (lp-api)

1. Acompanhante: SEMPRE nasce `status_presenca=CONFIRMADO`, `status_aereo=SEM AEREO`.
2. Presença "Pendente*" ao confirmar: SEMPRE → CONFIRMADO.
3. Aéreo "AGUARDANDO ORIGEM": SEMPRE → AEREO_COTAR.
4. Aéreo PENDENTE + patrocínio SIM (sem "input dados bilhete"): → EM EMISSAO.
5. PROIBIDO copiar voo de convidado em "Solicita Contato"/"Nova Opção de Voo" para outro (exige especialista).
