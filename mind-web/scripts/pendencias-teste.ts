/**
 * Gera operacao/pendencias.json com material de TESTE relativo a agora:
 *   npm run pendencias:teste            (12 pendências, mix realista)
 *   npm run pendencias:teste -- 40      (volume maior, p/ testar o limite do resumo)
 * O Motor de SLA processa esse arquivo; apague-o para voltar ao exemplo estático.
 */
import fs from "node:fs";
import path from "node:path";
import { resolverDadosRaiz } from "../lib/core.ts";

const qtd = Math.max(4, Number(process.argv[2]) || 12);
const agora = Date.now();
const h = (n: number) => new Date(agora + n * 3600_000).toISOString();

const NOMES = ["Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Alves", "Elisa Prado", "Fábio Rocha",
  "Gabi Nunes", "Heitor Dias", "Iara Melo", "João Pedro", "Karen Luz", "Lucas Vaz"];
const TIPOS = ["pendente-aereo", "transfer", "hospedagem", "upload-documento"];

// Quatro perfis em rotação: crítica estourada, crítica no prazo, alta no prazo, normal estourada
const PERFIS = [
  { abertaH: -4, eventoH: 24 },        // crítica (evento <48h), aberta há 4h, prazo 2h => ESTOURADA
  { abertaH: -1, eventoH: 30 },        // crítica no prazo (resta ~1h)
  { abertaH: -2, eventoH: 5 * 24 },    // alta (evento <7d), prazo 8h => no prazo
  { abertaH: -30, eventoH: 30 * 24 },  // normal (prazo 24h), aberta há 30h => ESTOURADA
];

const pendencias = Array.from({ length: qtd }, (_, i) => {
  const p = PERFIS[i % PERFIS.length];
  return {
    convidado: `${NOMES[i % NOMES.length]}${i >= NOMES.length ? ` ${Math.floor(i / NOMES.length) + 1}` : ""}`,
    tipo: TIPOS[i % TIPOS.length],
    abertaEm: h(p.abertaH),
    eventoEm: h(p.eventoH),
  };
});

const arquivo = path.join(resolverDadosRaiz(), "operacao", "pendencias.json");
fs.writeFileSync(arquivo, JSON.stringify({
  descricao: `MATERIAL DE TESTE gerado em ${new Date(agora).toISOString()} (npm run pendencias:teste). No produto real, virá da plataforma RSVP (integração de corpo).`,
  pendencias,
}, null, 2) + "\n");
console.log(`✅ ${pendencias.length} pendências de teste em operacao/pendencias.json (mix: estouradas + no prazo, todas as prioridades)`);
console.log(`   Pergunte à Mind: "quais convidados estão estourando o SLA?" · Para remover: rm operacao/pendencias.json`);
