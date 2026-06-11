---
id: kebab-case-do-documento
comunidade: recente | profunda   # camada de memória (pasta onde o doc vive)
titulo: Título legível
tipo: processo | regra | papel | conceito | doc-dev | chat | nota
dominio: atendimento-rsvp
sensibilidade: publico | interno | restrito | confidencial
tags: []
nos: []            # ids de nós do grafo ligados a este doc
relacionados: []   # ids de outros documentos de memória
fonte: de onde veio (chat-mind, nota do usuário, PDF, doc do sistema...)
atualizado_em: 2026-06-11
---

# Título

Conteúdo em Markdown. Ligações entre documentos com [[id-do-outro-doc]] (estilo matriz de
conhecimento). Este é o formato indexado/vetorizado pela memória (IGO Memory Server).

## Comunidades (camadas de memória)

- `_inbox/` — pré-memória: o que o mind-ingestor converteu e aguarda aprovação (freio).
  Invisível para a Mind.
- `recente/` — memória episódica: capturas de chat e notas rápidas, alimentada automaticamente.
- `profunda/` — memória semântica: conhecimento consolidado e curado.

O Motor de Memória (mind-ingestor) valida o padrão (`validar_padrao`), consolida o recente em
profundo (`consolidar`, sempre via `_inbox/` + aprovação) e mantém as notas-hub `_Comunidade — *.md`.
