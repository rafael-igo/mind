# Mind

Cérebro digital da empresa: concentra o conhecimento de tudo (operação, processos, regras,
desenvolvimento, clientes), alimentado por documentos e por entradas via chats e LLMs. Tem
**sinapses** (grafo de ligações), **motores** (córtex que pensa/decide), **cognição** (com freio
de governança) e o **corpo** (as plataformas: RSVP, LP, SigaEvento, Credenciamentos...).

## Fundação (origem: chat de concepção de 07/jun)

- [docs/00-CONCEITO.md](docs/00-CONCEITO.md) — o que é, metáfora cerebral, como a ideia nasceu, princípios.
- [docs/01-ARQUITETURA.md](docs/01-ARQUITETURA.md) — anatomia (Escuta→Orquestrador→Motores→Freio→Fala), JSON+Mermaid, motores, permissões, memória, stack.
- [docs/02-OPERACAO-RSVP.md](docs/02-OPERACAO-RSVP.md) — primeiro domínio: papéis, cascata, SLA.
- [docs/03-PLANO-DE-ARRANQUE.md](docs/03-PLANO-DE-ARRANQUE.md) — fases 0–6 com testes; decisões travadas.

## Estrutura

```
docs/          conceito, arquitetura, operação, plano, Fase 0
grafo/         FONTE DA VERDADE (JSON) — schema/ + atendimento.json (Mermaid é projeção)
memoria/       matriz de conhecimento (Markdown + frontmatter)
permissoes/    niveis.json + usuarios.exemplo.json
mind-web/      app Next.js (TypeScript): núcleo (lib/core.ts), API e tela
docker-compose.yml
```

## Stack

Next.js + TypeScript (API + interface num projeto só). Núcleo do cérebro em
`mind-web/lib/core.ts`. LLM via gateway OpenAI-compatível (IGO), com modo offline testável.

## Estado

Conceito fechado. **Fases 0–3 implementadas e testadas** (13/13 verde):

- **F0/F1** — grafo carrega/valida; orquestrador recupera memória, respeita permissão e não
  inventa sem registro. Memória em camadas: `recente/` (episódica), `profunda/` (semântica),
  `_inbox/` (pré-memória, invisível).
- **F2** — **Motor de SLA** (`lib/motor-sla.ts`, determinístico — a LLM roteia, o código calcula)
  classifica prioridade/estouro a partir de `operacao/pendencias*.json`.
- **F3** — **Cognição + Freio**: pedido de mudança → `lib/motor-cognitivo.ts` acha o nó-alvo,
  raciocina a **cascata** pelas arestas do grafo e redige proposta + perguntas → a proposta PARA
  em `operacao/propostas/` (`lib/freio.ts`). Só **diretor+ (rank ≥ 50)** decide; aprovada,
  consolida em `memoria/recente/decisao-*.md` — única porta de escrita na memória pelo ciclo
  cognitivo. Comandos: `aprovar proposta <id>` / `rejeitar proposta <id>`.

LLM real via **gateway exclusivo da Mind** (branch `mind-gateway` do igo-ai-gateway, porta 4101,
**Postgres no Docker** no lugar do Supabase): o `chamarGateway` detecta a chave `tnt_*`; **o
modelo é escolhido pelo nível do usuário** (operador→Haiku 4.5, coordenador/RH→Sonnet 4.6,
diretor→Opus 4.8, criador→Fable 5).

Rodar: `cd mind-web && npm install && npm run teste` (offline) ou
`node --env-file=.env --experimental-strip-types scripts/teste.ts` (com gateway).

Pendências suas: confirmar definição de **pendente aéreo** e os valores do **SLA** (os do motor
são os provisórios de `memoria/profunda/sla-rsvp.md`). Depois → Fase 4 (interface visual: grafo
clicável + chat).
