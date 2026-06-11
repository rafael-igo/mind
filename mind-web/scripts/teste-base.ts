/**
 * Testa a ingestão da BASE_CONHECIMENTO como memória externa da Mind.
 *   MIND_MEMORIA_EXTRA=/caminho/_md node --experimental-strip-types scripts/teste-base.ts
 */
import { carregarMemoria, orquestrar, resolverDadosRaiz } from "../lib/core.ts";

const raiz = resolverDadosRaiz();
const docs = carregarMemoria(raiz);
console.log(`Memória total: ${docs.length} documentos\n`);
for (const d of docs) {
  console.log(`  • ${d.id}  [${d.sensibilidade}]  — ${d.titulo}`);
}
console.log("\n--- Perguntas reais contra a base ---\n");

const perguntas: { usuario: string; texto: string }[] = [
  { usuario: "operador-exemplo", texto: "o que significa o status No Show?" },
  { usuario: "operador-exemplo", texto: "quais são os status do aéreo?" },
  { usuario: "operador-exemplo", texto: "quem é responsável pela malha aérea?" },
  { usuario: "operador-exemplo", texto: "quais são os ramais da empresa?" },
  { usuario: "rafael", texto: "quais são os ramais da empresa?" },
];

for (const p of perguntas) {
  const r = await orquestrar(p, raiz);
  console.log(`[${p.usuario}] ${p.texto}`);
  console.log(`   modo=${r.modo} permitido=${r.permitido} contexto=[${r.contexto.join(", ")}]`);
  console.log(`   → ${r.resposta.slice(0, 180).replace(/\n/g, " ")}\n`);
}
