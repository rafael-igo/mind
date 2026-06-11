---
projeto: Mind
documento: Plano de Arranque — Fases e Testes
status: fundação (v0) — entrega final do chat de concepção
data_consolidacao: 2026-06-11
---

# Mind — Plano de Arranque: Fases e Testes (v0)

## Decisões travadas

- **LLM por API, na nuvem** (consumo cloud).
- **Local depois:** quando houver máquina com GPU, testar com Ollama; modelo a indicar.
- **Memória:** reusar o que já existe — **IGO Memory Server ("egomemória")** e o estúdio em uso.
- **Liderança de design delegada à IA:** assumir as definições (função de cada item, divisões,
  grafo, interface); Rafael corrige o que não servir.
- **Trabalho seguirá em Claude Project + Claude Code**, uma fase por vez.

## Princípio de execução

Não construir o cérebro inteiro. Construir a **espinha mínima** e **testar a cada fase**. A
interface visual (o grafo) é a casca — vem depois do cérebro pensar. Testa-se cedo por **chat
simples**. O **teste da fase é o *definition of done*** — não passa para a próxima sem ele.

## Fases

### Fase 0 — Fundação esquelética
- **Construir:** grafo como JSON em Git (poucos nós tipados do Atendimento); memória com 3–5
  documentos Markdown reais (frontmatter + template), indexados no IGO Memory Server; login +
  tabela de permissões (níveis: criador/sócio, diretor, operador; sensibilidade nos docs).
- **Teste:** carregar o grafo, ler um documento, e o sistema sabe **quem sou eu** e meu nível.
- **Decisões da fase:** schema do nó; estrutura da tabela de permissão.

### Fase 1 — Orquestrador mínimo (o primeiro pensamento)
- **Construir:** Escuta → Orquestrador (identifica nó/contexto, checa permissão, puxa memória via
  vetor) → Fala. Sem motor ainda.
- **Teste:** *"o que é pendente aéreo?"* → acha o doc, respeita o nível, responde. Pergunta algo
  restrito com nível baixo → **nega**. (Testa orquestrador + recuperação + permissão
  determinística + fala.)

### Fase 2 — Primeiro motor determinístico (SLA)
- **Construir:** Motor de SLA (.NET, determinístico): dada lista/data → prazo, prioridade. O
  orquestrador agora pode **acionar** um motor, não só responder da memória.
- **Teste:** *"quais convidados estão estourando o SLA?"* → orquestrador chama o Motor de SLA →
  responde. Testa a fronteira: **a LLM roteia, o código calcula**.

### Fase 3 — Cognição + freio (raciocínio completo)
- **Construir:** um motor cognitivo (decisão/habilidade) + o **freio** (ação que muda a verdade
  pede aprovação).
- **Teste:** *"cliente quer alterar controle de salas"* → o cérebro raciocina a cascata, faz
  perguntas, propõe → **para no freio** → eu aprovo → **consolida na memória**. Testa o ciclo de
  raciocínio completo.

### Fase 4 — Interface visual (o grafo clicável + chat)
- **Construir:** o painel — diagrama clicável (Mermaid sobre o JSON) + chat lateral.
- **Teste:** clicar num nó abre o detalhe; instruir pelo chat edita o JSON e o diagrama
  reorganiza.

### Fase 4.5 — Memória Vetorial (busca por significado) ✅ entregue 11/jun/2026
- **Construir:** embeddings locais via **Ollama** (`nomic-embed-text`, prefixos de tarefa) em
  **pgvector** (Postgres do mind-gateway); indexação incremental por hash (`npm run indexar`);
  busca **híbrida** no orquestrador (vetorial complementa lexical); monitor no painel — a máquina
  do Ollama liga sob demanda e, desligada, a Mind **degrada para lexical** sem erro.
  Decisões: Mind independente do IGO AI Studio (banco de peças); só Claude (sem GPT);
  canal automático decidido pelo orquestrador (`docs/06-DEPARA-ORQUESTRADORES.md`).
- **Teste (`npm run teste:vetorial`, vivo):** pergunta **sem palavra-chave** acha o doc certo por
  significado; similaridade **não fura permissão** (podeVer depois da busca); orquestrador responde
  via busca híbrida. 4/4 verde.

### Fase 5 — Criatividade + Área do Criador ✅ entregue 11/jun/2026
- **Construir:** Motor de Criatividade / Resolução de Problemas
  (`mind-web/lib/motor-criatividade.ts`) — o ÚNICO motor autorizado a pensar além da memória,
  com hipóteses **rotuladas** (FATO × HIPÓTESE) e o modelo mais forte do nível (Fable 5).
  Explorações vivem em `operacao/criatividade/` (workspace, invisível à busca); **promover**
  uma exploração cria proposta que **PARA no freio**. Área do Criador no painel: workspace do
  nível máximo (rank 100, checado server-side) com explorações abertas e propostas pendentes,
  decisão em um clique.
- **Teste (na suíte hermética, 7 casos):** operador é negado no motor e na promoção; exploração
  NÃO vira memória direto; promover → freio; aprovação consolida pela única porta de escrita;
  sem promoção dupla. Ciclo vivo validado com o gateway (Fable 5 rotulando fato × hipótese).

### Fase 6+ — Expansão de domínios 🔄 primeira entrega 11/jun/2026
- **Entregue:** domínio **credenciamento** no grafo (`grafo/credenciamento.json` — check-in NFC,
  balcão, regras; ancorado SÓ na memória registrada `processo-de-check-in-nfc`), com aresta
  cruzando para o RSVP (lista de confirmados). **View cruzada de cascata**: `cascataTransitiva`
  anda as arestas em largura atravessando domínios; no chat, perguntas de impacto ("o que quebra
  se eu mexer em X?", "cascata de X") viram o modo `cascata` (determinístico, respeita
  sensibilidade dos nós); no painel, o card do nó ganha a **cascata profunda** (⤫ marca
  cruzamento de domínio). Perguntas de conhecimento ("como funciona a cascata logística?")
  continuam indo para a memória.
- **Próximos domínios:** logística (aéreo/transfer/hospedagem como nós), SigaEvento, LP —
  cada um entra ancorado em memória registrada, nunca inventado.

## Próximo movimento operacional

Quando Rafael colocar o Claude no Project, arranca-se pela **Fase 0**, levando só as decisões
dela — **o schema do nó e a tabela de permissão**. Uma fase por vez, sem despejar tudo.

Ver também: [Conceito](00-CONCEITO.md) · [Arquitetura](01-ARQUITETURA.md) ·
[Operação RSVP](02-OPERACAO-RSVP.md)
