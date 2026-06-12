---
id: ciclo-do-conhecimento
comunidade: profunda
titulo: Ciclo do Conhecimento — workers e LLMs por etapa
tipo: regra
dominio: mind-plataforma
sensibilidade: interno
tags: [ciclo, memoria, workers, llm, curadoria, governanca]
nos: [ciclo-do-conhecimento, motor-memoria-vetorial, mind-ingestor, gateway-mind]
relacionados: [decisao-20260611-arquitetura-vetorial]
fonte: definido por Rafael no chat de 12/jun/2026 ("sugestão → curto prazo p/ homologação → aprovação → profunda")
atualizado_em: 2026-06-12
---

# Ciclo do Conhecimento da Mind

```
sugestão/captura → _inbox (pré-memória) → recente (homologação) → profunda (conhecimento)
                       invisível à busca      busca normal            busca normal
```

Nada vira verdade sem decisão humana. Cada seta é uma aprovação de **diretor+ (rank ≥ 50)**.

## Etapas, workers e LLMs

| Etapa | O que acontece | Worker (determinístico) | LLM |
|---|---|---|---|
| **1. Sugestão** | `registrar: <regra>` no chat; recomendação de gestão da Mind; upload (.md/.txt/.html); texto novo no painel | orquestrador (`core.ts`) · editor de memória (`memoria-editor.ts`) | nenhum (a sugestão pode NASCER de uma resposta LLM, mas o registro é determinístico) |
| **2. Captura de chats** | conversas viram memória episódica (herda sensibilidade; restrito+ não captura) | mind-ingestor (MCP híbrido, HTTP 4180) | Haiku 4.5 (curadoria leve de título) |
| **3. Pré-memória** | doc espera no `_inbox/` — invisível à busca | editor de memória | nenhum |
| **4. Homologação** | aprovado para `recente/` — entra na busca, em observação | curadoria humana (diretor+) via painel 📚 | nenhum |
| **5. Consolidação** | homologado vira conhecimento em `profunda/` | curadoria humana (botão consolidar) · futuro **motor-consolidacao** ("o sono": propõe consolidações via freio) | futuro: modelo forte para propor fusões/resumos |
| **6. Indexação** | embeddings incrementais por hash a cada escrita | `indexarMemoria` (chunks 1000/200, pgvector) | **Ollama `nomic-embed-text`** (768 dims, local, liga sob demanda) |
| **7. Recuperação** | busca híbrida (lexical + vetorial), `podeVer()` SEMPRE depois; segue `relacionados:` e wikilinks (1 salto) | orquestrador | nenhum (busca é determinística) |
| **8. Fala/cognição** | resposta de gerente: REGISTRO × RECOMENDAÇÃO, trilha de escalonamento do grafo, oferece `registrar:` | orquestrador + grafo | por nível: operador/consultor → **Haiku 4.5** · coordenador/RH → **Sonnet 4.6** · diretor → **Opus 4.8** · criador → **Fable 5** (via gateway 4101: auditoria, budget) |
| **9. Mudança da verdade** | grafo/decisões só mudam por proposta **PARADA NO FREIO** | motor-cognitivo · freio · grafo-editor | modelo do nível redige a proposta; quem decide é humano |

## Regras fixas do ciclo

1. **Qualquer logado contribui** (etapa 1); **só diretor+ publica** (etapas 4–5).
2. `_inbox/`, `_lixeira/` e prefixo `_` = invisíveis à busca, sempre.
3. Excluir não existe: vai para `_lixeira/`.
4. Bases externas (`MIND_MEMORIA_EXTRA`) são somente leitura.
5. Toda escrita reindexa os vetores; sem Ollama, degrada para lexical sem erro.
