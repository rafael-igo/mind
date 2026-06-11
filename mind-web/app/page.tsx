"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const USUARIOS = ["rafael", "diretor-exemplo", "rh-exemplo", "operador-exemplo"];

interface Mensagem { de: "eu" | "mind"; texto: string; meta?: string }
interface DetalheNo {
  no: { id: string; tipo: string; titulo: string; descricao?: string; sensibilidade: string; status: string };
  arestas: { de: string; para: string; tipo: string; label?: string }[];
  memoria: { id: string; titulo: string; comunidade: string; sensibilidade: string }[];
}

export default function Painel() {
  const [usuario, setUsuario] = useState("rafael");
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheNo | null>(null);
  const [svg, setSvg] = useState("");
  const [idsNos, setIdsNos] = useState<string[]>([]);
  const grafoRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // ---- Grafo: busca JSON+Mermaid e renderiza (o diagrama é projeção, regenerada a cada mudança)
  const carregarGrafo = useCallback(async () => {
    const r = await fetch("/api/grafo");
    const g = await r.json();
    if (!g.mermaid) return;
    setIdsNos(g.nos.map((n: any) => n.id));
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose", flowchart: { curve: "basis" } });
    const { svg } = await mermaid.render(`grafo-${Date.now()}`, g.mermaid);
    setSvg(svg);
  }, []);

  useEffect(() => { carregarGrafo(); }, [carregarGrafo]);

  // ---- Clique no nó: o id do nó vem no id do <g class="node"> gerado pelo Mermaid
  useEffect(() => {
    const el = grafoRef.current;
    if (!el) return;
    const abrir = async (id: string) => {
      const r = await fetch(`/api/no/${id}`);
      if (r.ok) setDetalhe(await r.json());
    };
    const nodes = el.querySelectorAll<SVGGElement>("g.node");
    const handlers: { n: SVGGElement; fn: () => void }[] = [];
    nodes.forEach((n) => {
      const id = idsNos.find((i) => n.id.includes(`-${i}-`) || n.id.endsWith(`-${i}`) || n.id.includes(`flowchart-${i}`));
      if (!id) return;
      n.style.cursor = "pointer";
      const fn = () => abrir(id);
      n.addEventListener("click", fn);
      handlers.push({ n, fn });
    });
    return () => handlers.forEach(({ n, fn }) => n.removeEventListener("click", fn));
  }, [svg, idsNos]);

  // ---- Chat
  async function enviar() {
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;
    setTexto("");
    setMensagens((m) => [...m, { de: "eu", texto: pergunta }]);
    setPensando(true);
    try {
      const r = await fetch("/api/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, texto: pergunta }),
      });
      const j = await r.json();
      setMensagens((m) => [...m, {
        de: "mind",
        texto: j.resposta ?? j.erro ?? "(sem resposta)",
        meta: `${j.modo ?? "?"} · ${j.nivel ?? ""} · ${j.permitido === false ? "🚫" : "✅"}`,
      }]);
      // Se a Mind mudou a verdade (decisão aprovada), o diagrama reorganiza sozinho
      if (j.modo === "freio-decisao" || j.modo === "freio-proposta") await carregarGrafo();
    } finally {
      setPensando(false);
      setTimeout(() => chatRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 400px", height: "100vh" }}>
      {/* ---- Grafo ---- */}
      <section style={{ position: "relative", overflow: "auto", borderRight: "1px solid #232a45" }}>
        <header style={{ padding: "12px 20px", position: "sticky", top: 0, background: "#0b1020ee", zIndex: 2 }}>
          <b>🧠 Mind</b> <span style={{ opacity: 0.6, fontSize: 13 }}>— grafo (JSON é a verdade; clique num nó)</span>
        </header>
        <div ref={grafoRef} dangerouslySetInnerHTML={{ __html: svg }}
          style={{ padding: 20, minHeight: "70vh", display: "flex", justifyContent: "center" }} />

        {detalhe && (
          <aside style={{ position: "absolute", top: 60, left: 20, width: 340, padding: 16, borderRadius: 12,
            background: "#161c33", border: "1px solid #2c3558", boxShadow: "0 8px 30px #0008", zIndex: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{detalhe.no.titulo}</b>
              <span onClick={() => setDetalhe(null)} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {detalhe.no.tipo} · {detalhe.no.sensibilidade} · {detalhe.no.status} · <code>{detalhe.no.id}</code>
            </div>
            {detalhe.no.descricao && <p style={{ fontSize: 13, marginTop: 8 }}>{detalhe.no.descricao}</p>}
            <div style={{ fontSize: 12, marginTop: 8 }}>
              <b>Ligações</b>
              {detalhe.arestas.map((a, i) => (
                <div key={i} style={{ opacity: 0.8 }}>
                  {a.de === detalhe.no.id ? "→" : "←"} {a.de === detalhe.no.id ? a.para : a.de}
                  <i style={{ opacity: 0.6 }}> ({a.tipo}{a.label ? `: ${a.label}` : ""})</i>
                </div>
              ))}
              {detalhe.memoria.length > 0 && (<>
                <b style={{ display: "block", marginTop: 8 }}>Memória ligada</b>
                {detalhe.memoria.map((d) => (
                  <div key={d.id} style={{ opacity: 0.8 }}>📄 {d.titulo} <i style={{ opacity: 0.6 }}>({d.comunidade} · {d.sensibilidade})</i></div>
                ))}
              </>)}
            </div>
          </aside>
        )}
      </section>

      {/* ---- Chat ---- */}
      <section style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <header style={{ padding: 12, borderBottom: "1px solid #232a45" }}>
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }}>
            {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </header>
        <div ref={chatRef} style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {mensagens.length === 0 && (
            <div style={{ opacity: 0.55, fontSize: 13, lineHeight: 1.7 }}>
              Converse com a Mind. Exemplos:<br />
              · o que é pendente aéreo?<br />
              · quais convidados estão estourando o SLA?<br />
              · cliente quer alterar o controle de salas<br />
              · adicionar nó modulo "Rooming List"<br />
              · aprovar proposta &lt;id&gt;
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} style={{ alignSelf: m.de === "eu" ? "flex-end" : "flex-start", maxWidth: "92%",
              padding: "10px 12px", borderRadius: 12, whiteSpace: "pre-wrap", fontSize: 14,
              background: m.de === "eu" ? "#3b3f8f" : "#161c33", border: "1px solid #2c3558" }}>
              {m.texto}
              {m.meta && <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>{m.meta}</div>}
            </div>
          ))}
          {pensando && <div style={{ opacity: 0.6, fontSize: 13 }}>pensando…</div>}
        </div>
        <footer style={{ padding: 12, borderTop: "1px solid #232a45", display: "flex", gap: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
            placeholder="Fale com a Mind…"
            style={{ flex: 1, padding: 10, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }} />
          <button onClick={enviar} disabled={pensando}
            style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#6366f1", color: "white", cursor: "pointer" }}>
            ➤
          </button>
        </footer>
      </section>
    </main>
  );
}
