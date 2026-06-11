/**
 * Teste da Fase 4.5 — Memória Vetorial (VIVO: exige Ollama ligado + pgvector):
 *   npm run teste:vetorial   (usa .env)
 * Definition of done da fase: busca semântica acha por SIGNIFICADO (sem palavra-chave),
 * e a permissão continua valendo na via vetorial (similaridade não vaza confidencial).
 */
import { carregarMemoria, orquestrar } from "../lib/core.ts";
import { buscarVetorial, indexarMemoria, ollamaDisponivel } from "../lib/memoria-vetorial.ts";

process.env.MIND_INGESTOR_URL = ""; // hermético: não polui a memória recente
process.env.MIND_LLM_BASE_URL = ""; // offline: testa recuperação/permissão, não a fala

function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) process.exitCode = 1;
}

if (!(await ollamaDisponivel(true))) {
  console.log("🔌 Ollama desligado — teste vetorial pulado (ligue a máquina e rode de novo).");
  process.exit(0);
}

// garante índice atualizado (incremental por hash)
const r = await indexarMemoria(carregarMemoria());
ok(!!r && r.indexados + r.pulados > 0, `Vetorial — memória indexada (${r?.indexados} novos, ${r?.pulados} sem mudança, ${r?.chunks} chunks)`);

// 1) busca por SIGNIFICADO: pergunta sem as palavras-chave dos docs
const vet = await buscarVetorial("a passagem de avião do convidado ainda não saiu, de quem é a bola?", 5);
ok(!!vet && vet.length > 0 && vet.some((v) => ["pendente-aereo", "cascata-logistica", "papel-operador", "status-rsvp-e-aereo"].includes(v.docId)),
  `Vetorial — acha por significado, sem palavra-chave (top: ${vet?.slice(0, 3).map((v) => v.docId).join(", ")})`);

// 2) segurança: operador pergunta SEMANTICAMENTE sobre remuneração → não pode vazar pela via vetorial
const r2 = await orquestrar({ usuario: "operador-exemplo", texto: "quanto cada pessoa da equipe ganha por mês?" });
ok(!r2.resposta.toLowerCase().includes("salário base") && (r2.modo === "negado" || r2.modo === "sem-memoria" || !r2.contexto.includes("tabela-salarios")),
  `Vetorial — similaridade NÃO fura permissão (modo: ${r2.modo})`);

// 3) busca híbrida no orquestrador: pergunta semântica responde com a memória certa
const r3 = await orquestrar({ usuario: "rafael", texto: "a passagem de avião do convidado ainda não saiu, de quem é a bola?" });
ok(r3.permitido && r3.contexto.length > 0,
  `Vetorial — orquestrador respondeu via busca híbrida (contexto: ${r3.contexto.join(", ")})`);
