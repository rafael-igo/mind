/**
 * Projeção visual do grafo (Fase 4) — o JSON em grafo/ é a FONTE DA VERDADE;
 * o Mermaid gerado aqui é só render (padrão CQRS: modelo normalizado + projeção).
 */
import type { Grafo, No } from "./core.ts";

const ICONE: Record<No["tipo"], string> = {
  dominio: "🏛️",
  papel: "👤",
  motor: "⚙️",
  modulo: "📦",
  "bloco-regra": "📐",
};

/** Formato do nó por tipo (sintaxe Mermaid flowchart). */
function formatarNo(n: No): string {
  const rotulo = `"${ICONE[n.tipo]} ${n.titulo.replace(/"/g, "'")}"`;
  switch (n.tipo) {
    case "dominio": return `${n.id}([${rotulo}])`;
    case "motor": return `${n.id}{{${rotulo}}}`;
    case "modulo": return `${n.id}[[${rotulo}]]`;
    case "bloco-regra": return `${n.id}>${rotulo}]`;
    default: return `${n.id}[${rotulo}]`; // papel
  }
}

export function gerarMermaid(g: Grafo): string {
  const linhas: string[] = ["flowchart TD"];
  for (const n of g.nos) linhas.push(`  ${formatarNo(n)}:::${n.tipo.replace("bloco-regra", "regra")}`);
  for (const a of g.arestas) {
    const rotulo = a.label ? `${a.tipo}: ${a.label}` : a.tipo;
    const seta = a.tipo === "depende-de" ? "-.->" : "-->";
    linhas.push(`  ${a.de} ${seta}|"${rotulo.replace(/"/g, "'")}"| ${a.para}`);
  }
  linhas.push(
    "  classDef dominio fill:#312e81,stroke:#818cf8,color:#e0e7ff,stroke-width:2px",
    "  classDef papel fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe",
    "  classDef motor fill:#713f12,stroke:#fbbf24,color:#fef3c7",
    "  classDef modulo fill:#14532d,stroke:#4ade80,color:#dcfce7",
    "  classDef regra fill:#581c87,stroke:#c084fc,color:#f3e8ff"
  );
  return linhas.join("\n");
}
