---
projeto: Mind
documento: Arquitetura
status: fundação (v0 — proposta a validar com Rafael)
data_consolidacao: 2026-06-11
---

# Mind — Arquitetura

## Anatomia do cérebro (o ciclo de um "pensamento")

```
Escuta → Orquestrador (de input) → Memória/Motores → Freio → Fala
```

- **Escuta** — recebe a entrada (texto; voz depois). Captura também **quem** está falando.
- **Orquestrador** — identifica o nó/contexto no grafo, **checa permissão**, puxa a memória
  relevante (via vetor/índice) e decide se responde direto ou **aciona um motor**. É o "córtex
  integrador". Há também um **orquestrador de input** que resolve identidade e nível de acesso.
- **Motores** — as unidades de trabalho especializadas (ver abaixo). Determinísticos ou cognitivos.
- **Freio (controle inibitório)** — toda ação que **muda a verdade** exige aprovação/guardrail.
  A governança é parte da arquitetura cognitiva, não algo externo.
- **Fala (motor de fala)** — devolve a resposta **adaptada a quem perguntou** (nível de acesso e
  forma adequada).

Conceitualmente é **multi-agente**: várias mini-inteligências especializadas (como regiões
cerebrais) + um córtex que integra. Mantém-se a linguagem cerebral em vez do jargão.

## Fonte da verdade + projeção (padrão CQRS do Rafael)

- **Fonte da verdade:** JSON estruturado — nós, arestas e **metadados de cada bloco** (ex.: o
  bloco SLA com suas regras dentro).
- **Render:** o Mermaid é **gerado a partir do JSON** → renderizado no Vue (mermaid.js), com
  **nós clicáveis** (suporte nativo a click events).
- **Painel de detalhe:** clicar no nó abre o detalhe (regras, módulo planejado, status).
- **Chat lateral:** contexto = nó selecionado + JSON atual; LLM via gateway com **tools**.
- **Tools/regras:** `editar_no`, `criar_aresta`, `marcar_modulo`, etc., **com validação**.
  Preferir **patch/diff** a reescrever tudo.
- **Persistência:** JSON **versionado em Git** (rollback a versões anteriores).

## Tipos de nó e aresta (vocabulário do grafo)

- **Nós:** Domínio · Papel/Ator · Módulo · Motor · (blocos de regra como SLA).
- **Arestas:** fluxo · "escala para" / "delega para" (cascata de escalonamento) · dependência.
- **Topologia:** Mestre → Domínio → Papel/Ator. Um diagrama completo único, com **views** por
  domínio e **views cruzadas** para não perder cascatas que atravessam domínios.

## Motores (catálogo inicial — v0)

Cada motor precisa ser definido arquiteturalmente: regras, reversibilidade, de onde puxa, o que
é **algoritmo fixo/determinístico** vs. o que é **LLM expansível**, e o que a IA sempre deve
olhar para funcionar. Sempre baseado em **memória e processos**.

| Motor | Tipo | Função |
|---|---|---|
| Armazenamento (Memória) | infra + LLM | guardar/indexar/recuperar conhecimento |
| SLA | determinístico (.NET) | dado lista/data → prazo, prioridade |
| Atendimento | misto | regras de operação do atendimento RSVP |
| Habilidades | LLM | executa habilidades aprendidas (dev, processo, fluxo) |
| Decisão | cognitivo (LLM) | raciocina opções e decide |
| Criatividade / Resolução de Problemas | cognitivo (modelo forte) | gera opções/soluções inovadoras; serve principalmente à Área do Criador |
| Fala | misto | resposta adaptada ao nível de quem pergunta |

Habilidades que crescem → avaliar se exigem **novo motor** ou já estão embutidas no treinamento.
Motores podem conter **outros motores** dentro.

## Permissões e níveis de acesso

- **Login + tabela de permissões.** Níveis mínimos: **criador/sócio**, **diretor**, **operador**
  — e **sensibilidade** marcada em cada documento.
- O orquestrador de input resolve identidade → o motor de fala responde conforme o nível.
- Ex.: memórias financeiras / lista de funcionários e valores → só RH/diretor.
- Futuro: o próprio cérebro **sugere** a classificação de sensibilidade de cada doc.

## Área do Criador (transversal)

Nível máximo de acesso + uma **lente/workspace dedicada** onde Rafael cria, sugere, inova e
orquestra — "a parte de criatividade do cérebro". O Motor de Criatividade serve principalmente aqui.

## Memória (matriz de conhecimento)

- Documentos em **Markdown** com **frontmatter + template**, ligados entre si (estilo Obsidian:
  matriz de conhecimento, não RAG puro) — converter PDFs/docs em notas e ligá-las.
- **Indexados/vetorizados** para recuperação.
- Reusa a infra existente: **IGO Memory Server ("egomemória")** e o estúdio já em uso.

## Stack

- **Frontend:** Vue + Vuetify + Pinia + Vite + **mermaid.js** (nós clicáveis).
- **Motores determinísticos:** **.NET**.
- **Cognição/orquestração:** **LLM por API na nuvem** (gateway próprio — IGO OpenAI Gateway).
  Local depois (Ollama, quando houver máquina com GPU; modelo a indicar).
- **Memória:** IGO Memory Server.
- **Ecossistema:** I Go Journey + MCPs locais.

## Riscos e mitigações

- **"Pensar errado com confiança"** propaga erro (a Mind é a fonte da inteligência da empresa).
  Mitigações: memória **curada** (não inventa), ações reversíveis (versionamento), **freio** de
  aprovação sempre presente nas ações que mudam a verdade.
- **LLM quebrar o JSON/diagrama:** validação das tools + patch/diff + JSON como verdade (o Mermaid
  é só projeção).
- **Cada fase querer inchar:** o teste da fase é o *definition of done* — não avança sem passar.

Ver também: [Conceito](00-CONCEITO.md) · [Operação RSVP](02-OPERACAO-RSVP.md) ·
[Plano de Arranque](03-PLANO-DE-ARRANQUE.md)
