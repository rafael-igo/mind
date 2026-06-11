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

Conceito fechado. **Fase 0 e Fase 1 implementadas e testadas** (4/4 verde): grafo carrega/valida,
orquestrador recupera memória, respeita permissão (nega operador no confidencial, libera criador)
e não inventa sem registro. Rodar: `cd mind-web && npm install && npm run dev` (ou `npm run teste`).

Pendências suas: confirmar definição de **pendente aéreo** e valores do **SLA**. Depois → Fase 2
(Motor de SLA determinístico).
