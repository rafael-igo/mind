/**
 * Teste das Fases 0, 1 e 2 (roda sem servidor):
 *   node --experimental-strip-types scripts/teste.ts
 */
import { carregarGrafo, orquestrar, resolverDadosRaiz } from "../lib/core.ts";
import { calcularSla } from "../lib/motor-sla.ts";

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
console.log("   →", r4.resposta, "\n");

// --- Fase 2: Motor de SLA determinístico ---
const agora = new Date();
const h = (n: number) => new Date(agora.getTime() + n * 3600_000).toISOString();
const calc = calcularSla(
  [
    // evento em 24h (=> crítica, prazo 2h), pendência aberta há 3h => ESTOURADO
    { convidado: "Teste Crítico", tipo: "pendente-aereo", abertaEm: h(-3), eventoEm: h(24) },
    // evento em 5 dias (=> alta, prazo 8h), aberta há 1h => no prazo
    { convidado: "Teste Alta", tipo: "pendente-aereo", abertaEm: h(-1), eventoEm: h(5 * 24) },
    // evento em 30 dias (=> normal, prazo 24h), aberta há 30h => ESTOURADO
    { convidado: "Teste Normal", tipo: "hospedagem", abertaEm: h(-30), eventoEm: h(30 * 24) },
  ],
  agora
);
ok(
  calc[0].estourado && calc[0].prioridade === "critica" &&
    calc.find((c) => c.convidado === "Teste Alta")!.estourado === false &&
    calc.find((c) => c.convidado === "Teste Normal")!.estourado === true,
  "Fase 2 — Motor de SLA classifica prioridade e estouro corretamente (determinístico)"
);

const r5 = await orquestrar({ usuario: "operador-exemplo", texto: "quais convidados estão estourando o SLA?" }, raiz);
ok(r5.modo === "motor-sla" && r5.resposta.includes("Motor de SLA"),
  "Fase 2 — orquestrador roteia pergunta de SLA para o motor (LLM roteia, código calcula)");
console.log("   →", r5.resposta);
