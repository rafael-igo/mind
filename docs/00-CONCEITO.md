---
projeto: Mind
documento: Conceito e Base Conceitual
origem: Chat compartilhado de concepção (07/jun) — "todos os pensamentos para iniciar o projeto"
status: fundação (v0)
data_consolidacao: 2026-06-11
---

# Mind — Conceito

## O que é

A **Mind** é um cérebro digital da empresa: um sistema que concentra o conhecimento de tudo
(operação, processos, regras, desenvolvimento, clientes) e que é alimentado por documentos e
por entradas via chats e LLMs. Em vez de mil chats soltos, passa-se a conversar com a Mind —
e tudo fica registrado nela. Ela vira a **fonte da inteligência da empresa**, com memória e
orquestração.

A metáfora cerebral é literal na arquitetura:

- **Sinapses** — as ligações entre os nós de conhecimento/processo (o grafo).
- **Motores** — parte do "córtex frontal": fazem o pensamento, a consciência, as decisões e
  definem quem decide. É de onde vêm as habilidades (desenvolvimento, processos, fluxos),
  sempre oriundas das **memórias** e dos **motores**.
- **Cognição** — o raciocínio, com **controle inibitório** (o "freio") embutido: a governança
  não fica fora da IA, é parte da arquitetura cognitiva (o lobo do freio).
- **Corpo** — as plataformas da empresa (RSVP, LP, SigaEvento, Credenciamentos etc.).

A LLM tem papel duplo: é **copiloto** (ajuda o humano) e **orquestrador** (coordena os motores).
Além do humano — que valida, insere e pergunta — a LLM ajuda nas inteligências: motor de
armazenamento de informação, motor de habilidades, e assim por diante.

## Como a ideia nasceu (resumo do arco da conversa)

1. **Lousa branca da operação.** Rafael queria uma "lousa branca" / diagramação (estilo Figma)
   para mapear a operação de RSVP: o que o operador faz, o consultor, características, para onde
   vai, o que precisa, e os **efeitos cascata** (se acontece isso → acontece aquilo). Objetivo:
   rascunhar o que o sistema precisa ser, de forma simples e fácil para a própria IA trabalhar.

2. **Mermaid como meio.** Diagramas em texto (Mermaid), versionáveis, legíveis por devs. Um
   diagrama por papel + um diagrama-mãe ligando todos. SLA como bloco destacado; cascata em
   losangos de decisão; vermelho = crítico, verde = resolvido.

3. **O ecossistema próprio.** Rafael quer construir a ferramenta dele: abre o diagrama, tem um
   chat do lado conectado a um LLM (via gateway dele), clica num nó + dá instrução → o LLM edita
   o diagrama / cria um módulo, com regras específicas. Ser "um braço". Ele já tem o ecossistema
   **I Go Journey** com MCPs locais.

4. **JSON como fonte da verdade (sacada-chave).** Em vez de o LLM reescrever Mermaid (frágil),
   a fonte da verdade é um **JSON estruturado** (nós, arestas, metadados) e o Mermaid é só a
   **projeção/render**. O LLM mexe no JSON (seguro, validável). Isso alinha com o padrão que
   Rafael já usa (CQRS: modelo normalizado + projeção achatada de leitura).

5. **Versionamento + integrações.** JSON versionado em Git (voltar a versões anteriores).
   Integração futura com Obsidian (matriz de conhecimento em Markdown — converter PDFs/docs em
   notas ligadas, ex. "doc de processo X"), vetorização/RAG, documentos-verdade de cada cliente
   e regras de operação que o LLM consulta para entender cascatas e o que já existe.

6. **De vários diagramas para um cérebro.** A decisão evoluiu de "3-4 diagramas" para **um
   diagrama completo** (mais fácil para o LLM pensar) e daí para o conceito maior: não é só
   diagrama, é uma **mente** — um projeto, um código de verdade.

7. **Nome e metáfora travados:** o sistema se chama **Mind**, com **sinapses**, **motores** e
   **cognição**, funcionando como um cérebro.

8. **Permissões e consciência de quem pergunta.** Barreira de níveis de acesso (sócio, diretor,
   operador…). Um **orquestrador de input** sabe quem está perguntando; o **motor de fala**
   responde de acordo com o nível. Ex.: lista de funcionários e salários → só RH/diretor.

9. **Delegação de liderança.** Rafael pediu para a IA **parar de perguntar tanto** e **assumir**
   as definições de função de cada item, divisões, grafo e interface. A interface do cérebro =
   o grafo/diagrama (onde tudo começou), para acesso mais fácil.

## Princípios do projeto

- **Construir a espinha mínima e testar a cada fase** — não construir o cérebro inteiro de uma vez.
- **A interface visual (o grafo) é a casca; vem depois.** O cérebro precisa pensar antes de ter
  cara bonita. Nas primeiras fases testa-se por **chat de texto simples**.
- **Memória curada, não inventada.** O orquestrador trabalha sobre memória curada; não alucina.
- **Toda ação que muda a verdade é reversível** (versionamento) e passa pelo **freio**
  (aprovação/guardrail).
- **Sem dependência de runtime da Anthropic.** No produto, Rafael usa o **gateway dele** com o
  modelo que quiser; Mermaid aberto garante isso. Claude é copiloto de design/desenvolvimento.

Ver também: [Arquitetura](01-ARQUITETURA.md) · [Operação RSVP](02-OPERACAO-RSVP.md) ·
[Plano de Arranque](03-PLANO-DE-ARRANQUE.md)
