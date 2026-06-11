---
id: papeis-raci-rsvp
comunidade: profunda
titulo: Papéis reais do RSVP (RACI) — diverge do grafo atual da Mind
tipo: papel
dominio: atendimento-rsvp
sensibilidade: interno
tags: [papeis, raci, operador, consultor, especialista, escalonamento]
nos: [atendimento-rsvp, papel-operador, papel-consultor, papel-especialista, papel-coordenador]
relacionados: [papel-operador, status-rsvp-e-aereo]
fonte: BASE_CONHECIMENTO/operacional-papeis-responsabilidades.md (Operacional.xlsx, 2025-05-31) — 31 ações RACI
atualizado_em: 2026-06-11
---

# Papéis reais do RSVP (matriz RACI — 31 ações)

Verbos da matriz: **FAZER / CONFERIR / ACOMPANHAR / AJUDAR**.

| Papel | Função real |
|---|---|
| **Solicita RSVP** | cria evento, pasta, e-mail, input de convidados |
| **Especialista** | aprova com cliente, **confere** patrocínios, **acompanha** a operação |
| **Consultor** | **executa o RSVP** (ações 11–30), faz ativos por telefone/WhatsApp |
| **Operador** | ativos telefone/WhatsApp e ativo de presença |
| **Apoio** | input de convidados, contatos no Google, suporte |

## ⚠️ Divergência com o grafo atual da Mind

O grafo modela escalonamento linear `operador → consultor → especialista → coordenador`.
A matriz real é diferente: **o Consultor é quem executa o RSVP** (não um nível de escalada),
o **Especialista confere/aprova** (não é "casos técnicos"), e existem dois papéis que o grafo
não tem: **Solicita RSVP** e **Apoio**. "Coordenador" não aparece na matriz operacional
(aparece como gestor de fila no RSVP40). Ao validar, ajustar os nós `papel-*` do grafo.

## Regras operacionais dos papéis

- **Regra das 4 tentativas (Ação 16 — ativo por telefone):** após 4 ligações sem sucesso,
  status vira **PENDENTE CLIENTE** automaticamente (AstraZeneca: **PENDENTE OWNER**) + nota no RSVP.
- **Limite WhatsApp:** máx. **150 mensagens/dia** por linha (risco de bloqueio).
- **Status diário (Ação 22):** enviar todo dia no horário acordado; atenção a Pendente Convidado,
  Pendente RSVP e Nova Opção de Voo; informar ativos do dia no corpo do e-mail.
- **Carta informativa:** liberar voucher ("Sim") ANTES do disparo; status "Enviada" só depois do envio
  confirmado; compliance (dispensou/perdeu patrocínio) = envio manual obrigatório.
