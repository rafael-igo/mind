/**
 * Indexa a memória Markdown no pgvector (embeddings via Ollama local):
 *   node --env-file=.env --experimental-strip-types scripts/indexar.ts
 * Exige a máquina do Ollama LIGADA — sem ela, avisa e sai sem erro.
 */
import { carregarMemoria } from "../lib/core.ts";
import { indexarMemoria, ollamaDisponivel, saudeVetorial } from "../lib/memoria-vetorial.ts";

if (!(await ollamaDisponivel(true))) {
  console.log("🔌 Ollama indisponível (a máquina está ligada? MIND_OLLAMA_URL configurada?). Nada indexado.");
  process.exit(0);
}

const docs = carregarMemoria();
console.log(`Indexando ${docs.length} documento(s) de memória…`);
const r = await indexarMemoria(docs);
if (!r) {
  console.log("Banco vetorial indisponível (MIND_VETOR_DB). Nada indexado.");
  process.exit(0);
}
console.log(`✅ ${r.indexados} indexado(s), ${r.pulados} sem mudança (hash), ${r.chunks} chunk(s) gravados.`);
console.log("Estado:", JSON.stringify(await saudeVetorial()));
