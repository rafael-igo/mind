/**
 * Motor de SLA (Fase 2) — determinístico: a LLM roteia, ESTE código calcula.
 * Regras vivem em memoria/sla-rsvp.md (valores provisórios, a validar com Rafael).
 * Contrato estável (lista/data -> prazo, prioridade) para permitir extração futura para .NET.
 */

export type Prioridade = "critica" | "alta" | "normal";

export interface Pendencia {
  convidado: string;
  tipo: string; // ex.: "pendente-aereo", "hospedagem"
  abertaEm: string; // ISO
  eventoEm: string; // ISO
}

export interface ResultadoSla {
  convidado: string;
  tipo: string;
  prioridade: Prioridade;
  prazoHoras: number;
  limite: string; // ISO — abertaEm + prazo
  estourado: boolean;
  restanteMin: number; // negativo quando estourado
}

const HORA_MS = 60 * 60 * 1000;

// Regras provisórias de memoria/sla-rsvp.md: crítica 2h (evento <48h), alta 8h (evento <7d), normal 24h.
const REGRAS: { prioridade: Prioridade; prazoHoras: number; eventoEmMenosDeHoras: number }[] = [
  { prioridade: "critica", prazoHoras: 2, eventoEmMenosDeHoras: 48 },
  { prioridade: "alta", prazoHoras: 8, eventoEmMenosDeHoras: 7 * 24 },
  { prioridade: "normal", prazoHoras: 24, eventoEmMenosDeHoras: Infinity },
];

export function classificar(pendencia: Pendencia, agora: Date): ResultadoSla {
  const abertaEm = new Date(pendencia.abertaEm);
  const eventoEm = new Date(pendencia.eventoEm);
  if (isNaN(abertaEm.getTime()) || isNaN(eventoEm.getTime())) {
    throw new Error(`Datas inválidas na pendência de ${pendencia.convidado}`);
  }
  const horasAteEvento = (eventoEm.getTime() - agora.getTime()) / HORA_MS;
  const regra = REGRAS.find((r) => horasAteEvento < r.eventoEmMenosDeHoras)!;
  const limite = new Date(abertaEm.getTime() + regra.prazoHoras * HORA_MS);
  const restanteMin = Math.round((limite.getTime() - agora.getTime()) / 60000);
  return {
    convidado: pendencia.convidado,
    tipo: pendencia.tipo,
    prioridade: regra.prioridade,
    prazoHoras: regra.prazoHoras,
    limite: limite.toISOString(),
    estourado: restanteMin < 0,
    restanteMin,
  };
}

export function calcularSla(pendencias: Pendencia[], agora = new Date()): ResultadoSla[] {
  const ordem: Record<Prioridade, number> = { critica: 0, alta: 1, normal: 2 };
  return pendencias
    .map((p) => classificar(p, agora))
    .sort((a, b) => Number(b.estourado) - Number(a.estourado) || ordem[a.prioridade] - ordem[b.prioridade] || a.restanteMin - b.restanteMin);
}

/** Resumo legível do resultado — a resposta determinística da Mind (sem LLM). */
export function resumirSla(resultados: ResultadoSla[], agora = new Date()): string {
  if (resultados.length === 0) return "Nenhuma pendência registrada — nada estourando o SLA.";
  const estourados = resultados.filter((r) => r.estourado);
  const linhas = resultados.map((r) => {
    const status = r.estourado ? `🔴 ESTOURADO há ${Math.abs(r.restanteMin)} min` : `🟢 restam ${r.restanteMin} min`;
    return `- ${r.convidado} (${r.tipo}): prioridade ${r.prioridade}, prazo ${r.prazoHoras}h — ${status}`;
  });
  const cab =
    estourados.length === 0
      ? `Nenhum convidado estourando o SLA (${resultados.length} pendência(s) no prazo).`
      : `${estourados.length} de ${resultados.length} pendência(s) ESTOURANDO o SLA:`;
  return `${cab}\n${linhas.join("\n")}\n(cálculo determinístico do Motor de SLA em ${agora.toISOString()})`;
}
