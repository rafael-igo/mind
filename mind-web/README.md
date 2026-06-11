# mind-web

Backend + interface da Mind, em **Next.js (TypeScript)**. O núcleo do cérebro fica em
`lib/core.ts` (framework-agnóstico); a API são route handlers finos; a tela é só pra testar.

## Rodar local (sem Docker)

Pré-requisito: Node 20+ (testado no 22).

```bash
cd mind-web
npm install
npm run dev          # http://localhost:3000
```

A raiz dos dados (`grafo/`, `memoria/`, `permissoes/`) é resolvida subindo a partir da pasta —
em dev, basta rodar de dentro de `mind-web/` que ele acha o repositório acima.

## Teste do cérebro (sem servidor)

Roda o orquestrador direto contra os dados do repo (Fase 0 + Fase 1):

```bash
npm run teste
# ou: node --experimental-strip-types scripts/teste.ts
```

## API

- `GET  /api/grafo` — grafo completo (fonte da verdade).
- `GET  /api/no/:id` — um nó + suas arestas.
- `POST /api/perguntar` — `{ "usuario": "operador-exemplo", "texto": "o que é pendente aéreo?" }`
  → `{ nivel, permitido, modo, contexto, resposta }`.

Exemplo:

```bash
curl -s localhost:3000/api/perguntar \
  -H 'content-type: application/json' \
  -d '{"usuario":"operador-exemplo","texto":"o que é pendente aéreo?"}'
```

## LLM (gateway)

Configure em `.env` (veja `.env.example`):

```
MIND_LLM_BASE_URL=https://seu-gateway/v1
MIND_LLM_API_KEY=...
MIND_LLM_MODEL=...
```

Sem `MIND_LLM_BASE_URL`, a Mind roda em **modo offline**: prova recuperação + permissão sem
chamar LLM (útil pra teste determinístico). Com gateway, a resposta vem do modelo, mas **só com
base no contexto recuperado da memória** (não inventa).

## Base de conhecimento (memória externa)

A Mind pode ler memória de pastas externas além de `memoria/`, via `MIND_MEMORIA_EXTRA`
(pastas com `.md`, separadas por vírgula). Já testado com a **BASE_CONHECIMENTO** da I GO
(`_md/`): estratégia, matriz RACI, POP de status, processos/SLAs, ramais (restrito), resumos.

```bash
MIND_MEMORIA_EXTRA=/caminho/BASE_CONHECIMENTO/_md npm run teste:base
```

Sensibilidade de bases externas é normalizada (ex.: `alta`→restrito) e a memória própria da Mind
tem precedência em caso de id repetido. `README.md` e arquivos `_*.md` são ignorados.

## Docker

Do repositório (pasta acima):

```bash
docker compose up --build      # http://localhost:3000
```

O compose monta `grafo/ memoria/ permissoes/` como `/data` (somente leitura).
