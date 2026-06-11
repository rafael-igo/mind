---
projeto: Mind
documento: Operação RSVP (primeiro domínio a modelar)
status: fundação (v0)
data_consolidacao: 2026-06-11
---

# Operação RSVP — domínio inicial da Mind

O primeiro domínio a ser modelado no grafo. É o ponto de partida porque foi a "lousa branca"
que originou o projeto: mapear o que cada papel faz, o que precisa, e os efeitos cascata.

## Papéis / Atores (nó tipo Papel/Ator)

Cadeia de atendimento RSVP, com **cascata de escalonamento**:

```
operador → consultor → especialista → coordenador
```

Cada papel é um nó com: tarefas, processos, sistemas que usa, regras e o que pode/não pode fazer.
As relações entre papéis são arestas de **"escala para" / "delega para"**.

- **Operador (atendimento)** — linha de frente. Atende o convidado pelos canais (ligação,
  WhatsApp, email), verifica/atualiza status, segue o SLA. Quando não resolve, **escala**.
- **Consultor** — trata o que o operador escala; conhecimento mais específico do cliente/processo.
- **Especialista** — casos que exigem domínio técnico/profundo.
- **Coordenador** — topo da cascata; decisão e exceção.

## Fluxo do operador (exemplo modelado na conversa)

- Recebe contato → identifica convidado/evento → verifica status.
- **Cascata de decisão** (losangos): atendeu? não atendeu? estourou SLA? → escala.
- **SLA como bloco destacado** (subgraph): as regras de prazo ficam dentro do bloco, legíveis ao
  clicar/aproximar. Vermelho = crítico; verde = resolvido.
- Tudo passa pelos **motores de SLA** e **motores de atendimento**.

## SLA

Regras de prazo e prioridade. No produto vira o **Motor de SLA** (determinístico, .NET): dada uma
lista/data, calcula prazo e prioridade. Pergunta-teste do domínio: *"quais convidados estão
estourando o SLA?"*.

## Domínios (cada um vira uma view do grafo completo)

- **Atendimento RSVP** (este documento) — operador, consultor, especialista, coordenador.
- **Credenciamento** — próximo domínio.
- Demais plataformas (LP, SigaEvento etc.) entram na expansão.

Um **diagrama completo único** com views por domínio e **views cruzadas** para cascatas que
atravessam domínios (ex.: um efeito no atendimento que afeta o credenciamento).

## Como o cérebro usa este domínio

O LLM, ao olhar o grafo e "pegar" um nó, consulta os **documentos-verdade** do sistema (processos
de cada cliente, regras de operação, docs de desenvolvimento) para entender os efeitos cascata e
o que já existe desenvolvido — e então sugere o módulo/ajuste por um caminho ("crie esse módulo
por esse caminho"), virando instrução para os devs.

## Vocabulário a confirmar

- "Pendente aéreo" e outros termos operacionais → viram documentos de memória (a Fase 1 testa a
  recuperação com *"o que é pendente aéreo?"*).

Ver também: [Conceito](00-CONCEITO.md) · [Arquitetura](01-ARQUITETURA.md) ·
[Plano de Arranque](03-PLANO-DE-ARRANQUE.md)
