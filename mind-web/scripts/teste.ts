/**
 * Teste da Fase 0 + Fase 1 (roda sem servidor):
 *   node --experimental-strip-types scripts/teste.ts
 */
import { carregarGrafo, orquestrar, resolverDadosRaiz } from "../lib/core.ts";

function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) process.exitCode = 1;
}

const raiz = resolverDadosRaiz();
console.log("Raiz dos dados:", raiz, "\n");

// --- Fase 0: grafo carrega e valida ---
const g = carregarGrafo(raiz);
ok(g.nos.length > 0 && g.arestas.length > 0, `Fase 0 — grafo carrega e valida (${g.nos.length} nós, ${g.arestas.length} arestas)`);

// --- Fase 1: recuperação + permissão + fala ---
const r1 = await orquestrar({ usuario: "operador-exemplo", texto: "o que é pendente aéreo?" }, raiz);
ok(r1.contexto.includes("pendente-aereo") && r1.permitido,
  `Fase 1 — operador pergunta 'pendente aéreo' → acha e responde (modo: ${r1.modo})`);
console.log("   →", r1.resposta, "\n");

const r2 = await orquestrar({ usuario: "operador-exemplo", texto: "qual o salário dos funcionários?" }, raiz);
ok(!r2.permitido && r2.modo === "negado",
  "Fase 1 — operador pergunta 'salário' (confidencial) → NEGado");
console.log("   →", r2.resposta, "\n");

const r3 = await orquestrar({ usuario: "rafael", texto: "qual o salário dos funcionários?" }, raiz);
ok(r3.permitido && r3.contexto.includes("tabela-salarios"),
  "Fase 1 — criador pergunta 'salário' → PERMITIDO");
console.log("   →", r3.resposta, "\n");

const r4 = await orquestrar({ usuario: "operador-exemplo", texto: "como funciona o credenciamento lunar?" }, raiz);
ok(r4.modo === "sem-memoria", "Fase 1 — pergunta sem registro → 'sem memória' (não inventa)");
console.log("   →", r4.resposta);
