"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface Sessao { usuario: string; nome: string; nivel: string }
interface Mensagem { de: "eu" | "mind"; texto: string; meta?: string }
interface AreaCriador {
  exploracoes: { id: string; problema: string; criadaEm: string; abordagens: number }[];
  propostasPendentes: { id: string; pedido: string; autor: string; criadaEm: string; noAlvo: string }[];
}
interface DocLista {
  id: string; titulo: string; tipo: string; comunidade: string;
  sensibilidade: string; tags: string[]; tamanho: number; editavel: boolean;
}
interface DocAberto {
  id?: string; titulo: string; corpo: string; comunidade: string;
  sensibilidade: string; tags: string[]; editavel: boolean; novo?: boolean;
}
const SENSIBILIDADES = ["publico", "interno", "restrito", "confidencial"];
interface DetalheNo {
  no: { id: string; tipo: string; titulo: string; descricao?: string; sensibilidade: string; status: string };
  arestas: { de: string; para: string; tipo: string; label?: string }[];
  memoria: { id: string; titulo: string; comunidade: string; sensibilidade: string }[];
  cascata?: { profundidade: number; itens: { no: string; titulo: string; relacao: string; dominio: string | null; cruzaDominio: boolean }[] }[];
}

export default function Painel() {
  const [eu, setEu] = useState<Sessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [loginUsuario, setLoginUsuario] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginErro, setLoginErro] = useState("");
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheNo | null>(null);
  const [svg, setSvg] = useState("");
  const [idsNos, setIdsNos] = useState<string[]>([]);
  const [saude, setSaude] = useState<{ gateway: boolean; ollama: boolean; vetorial: { chunks: number | null } } | null>(null);
  const [criador, setCriador] = useState<AreaCriador | null>(null);
  const [foco, setFoco] = useState<{ id: string; titulo: string } | null>(null);
  const [memAberta, setMemAberta] = useState(false);
  const [memLista, setMemLista] = useState<{ docs: DocLista[]; inbox: DocLista[]; curador: boolean } | null>(null);
  const [memDoc, setMemDoc] = useState<DocAberto | null>(null);
  const [memInfo, setMemInfo] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);
  const grafoRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // ---- Sessão: quem sou eu? (cookie HTTP-only assinado; sem sessão => tela de login)
  useEffect(() => {
    fetch("/api/eu")
      .then(async (r) => setEu(r.ok ? await r.json() : null))
      .catch(() => setEu(null))
      .finally(() => setCarregandoSessao(false));
  }, []);

  async function entrar() {
    setLoginErro("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuario: loginUsuario.trim(), senha: loginSenha }),
    });
    if (r.ok) { setEu(await r.json()); setLoginSenha(""); }
    else setLoginErro((await r.json()).erro ?? "Falha no login.");
  }

  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    setEu(null);
    setMensagens([]);
    setCriador(null);
    setDetalhe(null);
  }

  // ---- Área do Criador (Fase 5): identidade vem da sessão; o servidor decide (403 => some)
  const carregarCriador = useCallback(async () => {
    try {
      const r = await fetch("/api/criador");
      setCriador(r.ok ? await r.json() : null);
    } catch {
      setCriador(null);
    }
  }, []);

  useEffect(() => { if (eu) carregarCriador(); }, [eu, carregarCriador]);

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

  useEffect(() => { if (eu) carregarGrafo(); }, [eu, carregarGrafo]);

  // Monitor (Ollama liga sob demanda — o badge mostra quando a máquina está de pé)
  useEffect(() => {
    if (!eu) return;
    const checar = () => fetch("/api/saude").then((r) => r.json()).then(setSaude).catch(() => setSaude(null));
    checar();
    const t = setInterval(checar, 30_000);
    return () => clearInterval(t);
  }, [eu]);

  // ---- Clique no nó: DELEGAÇÃO no container (um listener só) — sobrevive a qualquer
  // re-render do Mermaid; listeners por nó morriam quando o SVG era trocado por baixo.
  useEffect(() => {
    const el = grafoRef.current;
    if (!el) return;
    const fn = (ev: Event) => {
      const g = (ev.target as Element).closest?.("g.node");
      if (!g) return;
      const id = idsNos.find((i) => g.id.includes(`-${i}-`) || g.id.endsWith(`-${i}`) || g.id.includes(`flowchart-${i}`));
      if (!id) return;
      fetch(`/api/no/${id}`).then(async (r) => { if (r.ok) setDetalhe(await r.json()); });
    };
    el.addEventListener("click", fn);
    return () => el.removeEventListener("click", fn);
  }, [idsNos]);

  // ---- 📚 Memória: input de dados/arquivos + edição dos RAGs (curadoria humana)
  const carregarMemLista = useCallback(async () => {
    const r = await fetch("/api/memoria");
    if (r.ok) setMemLista(await r.json());
  }, []);

  useEffect(() => { if (eu && memAberta) carregarMemLista(); }, [eu, memAberta, carregarMemLista]);

  async function abrirMemDoc(id: string) {
    const r = await fetch(`/api/memoria/${id}`);
    if (r.ok) { setMemDoc(await r.json()); setMemInfo(""); }
    else setMemInfo((await r.json()).erro ?? "não consegui abrir");
  }

  async function salvarMemDoc() {
    if (!memDoc) return;
    const corpoReq = {
      titulo: memDoc.titulo, corpo: memDoc.corpo, sensibilidade: memDoc.sensibilidade,
      tags: memDoc.tags, comunidade: memDoc.comunidade,
    };
    const r = memDoc.novo
      ? await fetch("/api/memoria", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpoReq) })
      : await fetch(`/api/memoria/${memDoc.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(corpoReq) });
    const j = await r.json();
    if (r.ok) { setMemInfo(memDoc.novo ? `✅ criado (${j.id}) em ${j.comunidade ?? memDoc.comunidade}` : "✅ salvo"); setMemDoc(null); carregarMemLista(); }
    else setMemInfo(`⚠️ ${j.erro}`);
  }

  async function aprovarMemDoc(id: string, destino: "recente" | "profunda") {
    const r = await fetch(`/api/memoria/${id}/aprovar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destino }) });
    const j = await r.json();
    setMemInfo(r.ok ? `✅ aprovado para ${destino}` : `⚠️ ${j.erro}`);
    setMemDoc(null);
    carregarMemLista();
  }

  async function lixeiraMemDoc(id: string) {
    const r = await fetch(`/api/memoria/${id}`, { method: "DELETE" });
    const j = await r.json();
    setMemInfo(r.ok ? "🗑️ movido para a _lixeira" : `⚠️ ${j.erro}`);
    setMemDoc(null);
    carregarMemLista();
  }

  async function uploadMemArquivo(f: File) {
    const fd = new FormData();
    fd.append("arquivo", f);
    const r = await fetch("/api/memoria/upload", { method: "POST", body: fd });
    const j = await r.json();
    setMemInfo(r.ok ? `✅ "${f.name}" importado para o _inbox (${j.id}) — aguardando curadoria` : `⚠️ ${j.erro}`);
    carregarMemLista();
  }

  // ---- Foco (card → chat): o HUMANO pergunta; a Mind anexa o contexto do nó.
  // Sem chamada de LLM aqui — só orientação local para o usuário saber o que dá pra fazer.
  function focarNoChat() {
    if (!detalhe) return;
    const d = detalhe;
    setFoco({ id: d.no.id, titulo: d.no.titulo });
    setDetalhe(null);
    const orientacao =
      `🎯 Nó em foco: ${d.no.titulo} (${d.no.tipo} · ${d.no.status})\n` +
      (d.no.descricao ? `${d.no.descricao}\n` : "") +
      `Ligações: ${d.arestas.length} · Memória ligada: ${d.memoria.length} doc(s)\n\n` +
      `Pode perguntar qualquer coisa — vou responder com o contexto deste nó. Sugestões:\n` +
      `· "o que quebra se eu mexer aqui?" — impacto em cascata\n` +
      `· "explica o nó ${d.no.id}" — ficha completa com as regras registradas\n` +
      `· descreva uma mudança ("ajustar/alterar…") — vira proposta e PARA no freio\n` +
      (eu?.nivel === "criador" ? `· "brainstorm: …" — explorar ideias (Área do Criador)\n` : "") +
      `Para soltar o foco, clique no ✕ ao lado do campo de texto.`;
    setMensagens((m) => [...m, { de: "mind", texto: orientacao, meta: "foco · sem custo de LLM" }]);
    setTimeout(() => chatRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
  }

  // ---- Chat (os botões da Área do Criador passam pelo MESMO orquestrador via `comando`)
  async function enviar(comando?: string) {
    const pergunta = (comando ?? texto).trim();
    if (!pergunta || pensando) return;
    if (!comando) setTexto("");
    setMensagens((m) => [...m, { de: "eu", texto: pergunta }]);
    setPensando(true);
    try {
      const r = await fetch("/api/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: pergunta, foco: foco?.id }), // identidade vem da sessão, não do corpo
      });
      const j = await r.json();
      setMensagens((m) => [...m, {
        de: "mind",
        texto: j.resposta ?? j.erro ?? "(sem resposta)",
        meta: `${j.modo ?? "?"} · ${j.nivel ?? ""} · ${j.permitido === false ? "🚫" : "✅"}`,
      }]);
      // Se a Mind mudou a verdade (decisão aprovada), o diagrama reorganiza sozinho
      if (j.modo === "freio-decisao" || j.modo === "freio-proposta") await carregarGrafo();
      // Workspace do criador acompanha o ciclo: explorar → promover → decidir
      if (["criatividade", "freio-proposta", "freio-decisao"].includes(j.modo)) await carregarCriador();
    } finally {
      setPensando(false);
      setTimeout(() => chatRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }

  // ---- Tela de login (sem sessão, nada do cérebro carrega — as APIs também barram)
  if (carregandoSessao) {
    return <main style={{ display: "grid", placeItems: "center", height: "100vh", opacity: 0.5 }}>🧠 …</main>;
  }
  if (!eu) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <form onSubmit={(e) => { e.preventDefault(); entrar(); }}
          style={{ width: 320, padding: 24, borderRadius: 16, background: "#161c33", border: "1px solid #2c3558",
            display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 20, textAlign: "center", marginBottom: 6 }}>🧠 <b>Mind</b></div>
          <input value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} placeholder="usuário" autoFocus
            style={{ padding: 10, borderRadius: 8, background: "#0b1020", color: "#e6e9f0", border: "1px solid #2c3558" }} />
          <input value={loginSenha} onChange={(e) => setLoginSenha(e.target.value)} placeholder="senha" type="password"
            style={{ padding: 10, borderRadius: 8, background: "#0b1020", color: "#e6e9f0", border: "1px solid #2c3558" }} />
          {loginErro && <div style={{ color: "#f87171", fontSize: 13 }}>{loginErro}</div>}
          <button type="submit"
            style={{ padding: 10, borderRadius: 8, border: 0, background: "#6366f1", color: "white", cursor: "pointer" }}>
            entrar
          </button>
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: "center" }}>
            sem senha? peça ao criador: <code>npm run usuario -- &lt;id&gt; &lt;senha&gt;</code>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 400px", height: "100vh" }}>
      {/* ---- Grafo ---- */}
      <section style={{ position: "relative", overflow: "auto", borderRight: "1px solid #232a45" }}>
        <header style={{ padding: "12px 20px", position: "sticky", top: 0, background: "#0b1020ee", zIndex: 2,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span><b>🧠 Mind</b> <span style={{ opacity: 0.6, fontSize: 13 }}>— {memAberta ? "memória (curadoria)" : "grafo (JSON é a verdade; clique num nó)"}</span></span>
          <span style={{ fontSize: 12, display: "flex", gap: 10, alignItems: "center" }}>
            {saude && (<>
              <span title="Gateway LLM (4101)">{saude.gateway ? "🟢" : "🔴"} gateway</span>
              <span title="Ollama — embeddings; a máquina liga sob demanda">
                {saude.ollama ? "🟢" : "⚪"} ollama{saude.ollama ? "" : " (desligado — busca lexical)"}
              </span>
              <span title="Chunks na memória vetorial (pgvector)">🧩 {saude.vetorial.chunks ?? "—"}</span>
            </>)}
            <button onClick={() => { setMemAberta(!memAberta); setMemDoc(null); }}
              style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid #2c3558",
                background: memAberta ? "#6366f1" : "transparent", color: "#e6e9f0", cursor: "pointer" }}>
              {memAberta ? "🕸️ grafo" : "📚 memória"}
            </button>
          </span>
        </header>
        <style>{"g.node { cursor: pointer } g.node:hover { opacity: 0.85 }"}</style>

        {/* ---- 📚 Memória: input de dados/arquivos + edição dos RAGs ---- */}
        {memAberta && (
          <div style={{ padding: 20, maxWidth: 860, margin: "0 auto" }}>
            {memInfo && <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{memInfo}</div>}

            {!memDoc && (<>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMemDoc({ titulo: "", corpo: "", comunidade: memLista?.curador ? "profunda" : "_inbox", sensibilidade: "interno", tags: [], editavel: true, novo: true })}
                  style={{ padding: "8px 14px", borderRadius: 8, border: 0, background: "#6366f1", color: "white", cursor: "pointer", fontSize: 13 }}>
                  ➕ novo documento
                </button>
                <button onClick={() => arquivoRef.current?.click()}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #2c3558", background: "transparent", color: "#e6e9f0", cursor: "pointer", fontSize: 13 }}>
                  ⬆️ importar arquivo (.md .txt .html)
                </button>
                <input ref={arquivoRef} type="file" accept=".md,.txt,.html,.htm" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMemArquivo(f); e.target.value = ""; }} />
              </div>

              {memLista?.curador && (
                <div style={{ marginBottom: 16 }}>
                  <b style={{ fontSize: 14 }}>📥 _inbox (pré-memória aguardando curadoria)</b>
                  {memLista.inbox.length === 0 && <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>vazio</div>}
                  {memLista.inbox.map((d) => (
                    <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 13 }}>
                      <span onClick={() => abrirMemDoc(d.id)} style={{ flex: 1, cursor: "pointer" }}>📄 {d.titulo} <i style={{ opacity: 0.5 }}>({Math.round(d.tamanho / 100) / 10}k)</i></span>
                      <button onClick={() => aprovarMemDoc(d.id, "recente")} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#16a34a", color: "white", cursor: "pointer" }}>→ recente</button>
                      <button onClick={() => aprovarMemDoc(d.id, "profunda")} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#0e7490", color: "white", cursor: "pointer" }}>→ profunda</button>
                      <button onClick={() => lixeiraMemDoc(d.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#dc2626", color: "white", cursor: "pointer" }}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              {["profunda", "recente"].map((com) => (
                <div key={com} style={{ marginBottom: 16 }}>
                  <b style={{ fontSize: 14 }}>{com === "profunda" ? "🧠 profunda (semântica)" : "🕐 recente (episódica)"}</b>
                  {memLista?.docs.filter((d) => d.comunidade === com).map((d) => (
                    <div key={d.id} onClick={() => abrirMemDoc(d.id)}
                      style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 13, cursor: "pointer" }}>
                      <span style={{ flex: 1 }}>📄 {d.titulo}</span>
                      <span style={{ opacity: 0.5, fontSize: 11 }}>{d.sensibilidade} · {Math.round(d.tamanho / 100) / 10}k</span>
                    </div>
                  ))}
                </div>
              ))}

              {(memLista?.docs.some((d) => !d.editavel) ?? false) && (
                <div style={{ marginBottom: 16 }}>
                  <b style={{ fontSize: 14 }}>🔗 bases externas <i style={{ opacity: 0.5, fontWeight: "normal" }}>(somente leitura)</i></b>
                  {memLista!.docs.filter((d) => !d.editavel).map((d) => (
                    <div key={d.id} onClick={() => abrirMemDoc(d.id)}
                      style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 13, cursor: "pointer", opacity: 0.75 }}>
                      <span style={{ flex: 1 }}>📄 {d.titulo}</span>
                      <span style={{ opacity: 0.6, fontSize: 11 }}>{d.sensibilidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {memDoc && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span onClick={() => setMemDoc(null)} style={{ cursor: "pointer", opacity: 0.7, fontSize: 13 }}>← voltar</span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    {memDoc.novo ? "novo documento" : `${memDoc.id} · ${memDoc.comunidade}`}{!memDoc.editavel && " · 🔗 somente leitura"}
                  </span>
                </div>
                <input value={memDoc.titulo} onChange={(e) => setMemDoc({ ...memDoc, titulo: e.target.value })}
                  placeholder="título" disabled={!memDoc.editavel}
                  style={{ padding: 10, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558", fontSize: 15 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  {memDoc.novo && memLista?.curador && (
                    <select value={memDoc.comunidade} onChange={(e) => setMemDoc({ ...memDoc, comunidade: e.target.value })}
                      style={{ padding: 8, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }}>
                      <option value="profunda">profunda</option>
                      <option value="recente">recente</option>
                      <option value="_inbox">_inbox</option>
                    </select>
                  )}
                  <select value={memDoc.sensibilidade} disabled={!memDoc.editavel || !memLista?.curador}
                    onChange={(e) => setMemDoc({ ...memDoc, sensibilidade: e.target.value })}
                    style={{ padding: 8, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }}>
                    {SENSIBILIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input value={memDoc.tags.join(", ")} disabled={!memDoc.editavel}
                    onChange={(e) => setMemDoc({ ...memDoc, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                    placeholder="tags (separadas por vírgula)"
                    style={{ flex: 1, padding: 8, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }} />
                </div>
                <textarea value={memDoc.corpo} onChange={(e) => setMemDoc({ ...memDoc, corpo: e.target.value })}
                  readOnly={!memDoc.editavel} placeholder="conteúdo em Markdown…"
                  style={{ minHeight: "48vh", padding: 12, borderRadius: 8, background: "#161c33", color: "#e6e9f0",
                    border: "1px solid #2c3558", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  {memDoc.editavel && (memLista?.curador || memDoc.novo) && (
                    <button onClick={salvarMemDoc}
                      style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#6366f1", color: "white", cursor: "pointer" }}>
                      💾 salvar{memDoc.novo && !memLista?.curador ? " no _inbox (curadoria)" : ""}
                    </button>
                  )}
                  {!memDoc.novo && memDoc.comunidade === "_inbox" && memLista?.curador && (<>
                    <button onClick={() => aprovarMemDoc(memDoc.id!, "recente")} style={{ padding: "10px 14px", borderRadius: 8, border: 0, background: "#16a34a", color: "white", cursor: "pointer" }}>aprovar → recente</button>
                    <button onClick={() => aprovarMemDoc(memDoc.id!, "profunda")} style={{ padding: "10px 14px", borderRadius: 8, border: 0, background: "#0e7490", color: "white", cursor: "pointer" }}>aprovar → profunda</button>
                  </>)}
                  {!memDoc.novo && memDoc.editavel && memLista?.curador && (
                    <button onClick={() => lixeiraMemDoc(memDoc.id!)} style={{ marginLeft: "auto", padding: "10px 14px", borderRadius: 8, border: 0, background: "#dc2626", color: "white", cursor: "pointer" }}>🗑️ lixeira</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!memAberta && <div ref={grafoRef} dangerouslySetInnerHTML={{ __html: svg }}
          style={{ padding: 20, minHeight: "70vh", display: "flex", justifyContent: "center" }} />}

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
            <button onClick={() => focarNoChat()} disabled={pensando}
              style={{ width: "100%", marginTop: 8, padding: "8px 12px", borderRadius: 8, border: 0,
                background: "#6366f1", color: "white", cursor: "pointer", fontSize: 13 }}>
              🎯 focar no chat
            </button>
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
              {!!detalhe.cascata?.length && (<>
                <b style={{ display: "block", marginTop: 8 }}>🌊 Cascata profunda <i style={{ opacity: 0.6 }}>(⤫ cruza domínio)</i></b>
                {detalhe.cascata.map((nv) => (
                  <div key={nv.profundidade} style={{ opacity: 0.8 }}>
                    <i style={{ opacity: 0.6 }}>nível {nv.profundidade}:</i>{" "}
                    {nv.itens.map((i) => `${i.cruzaDominio ? "⤫ " : ""}${i.titulo}`).join("; ")}
                  </div>
                ))}
              </>)}
            </div>
          </aside>
        )}
      </section>

      {/* ---- Chat ---- */}
      <section style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <header style={{ padding: 12, borderBottom: "1px solid #232a45", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>
            👤 <b>{eu.nome}</b> <span style={{ opacity: 0.6, fontSize: 12 }}>({eu.nivel})</span>
          </span>
          <button onClick={sair}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #2c3558", background: "transparent", color: "#e6e9f0", cursor: "pointer" }}>
            sair
          </button>
        </header>

        {/* ---- Área do Criador (Fase 5): workspace do nível máximo — o servidor barra, aqui só mostra */}
        {criador && (
          <div style={{ padding: 12, borderBottom: "1px solid #232a45", background: "#12172b", maxHeight: "32vh", overflow: "auto" }}>
            <b style={{ fontSize: 13 }}>🎨 Área do Criador</b>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <b style={{ opacity: 0.8 }}>Explorações abertas</b>
              {criador.exploracoes.length === 0 && <div style={{ opacity: 0.5 }}>nenhuma — peça um brainstorm no chat</div>}
              {criador.exploracoes.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span style={{ flex: 1, opacity: 0.85 }} title={e.id}>💡 {e.problema.slice(0, 60)}</span>
                  <button onClick={() => enviar(`promover exploracao ${e.id}`)} disabled={pensando}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#6366f1", color: "white", cursor: "pointer" }}>
                    promover
                  </button>
                </div>
              ))}
              <b style={{ opacity: 0.8, display: "block", marginTop: 8 }}>Propostas no freio</b>
              {criador.propostasPendentes.length === 0 && <div style={{ opacity: 0.5 }}>nenhuma pendente</div>}
              {criador.propostasPendentes.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <span style={{ flex: 1, opacity: 0.85 }} title={`${p.id} · alvo: ${p.noAlvo}`}>🧠 {p.pedido.slice(0, 60)}</span>
                  <button onClick={() => enviar(`aprovar proposta ${p.id}`)} disabled={pensando}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#16a34a", color: "white", cursor: "pointer" }}>
                    aprovar
                  </button>
                  <button onClick={() => enviar(`rejeitar proposta ${p.id}`)} disabled={pensando}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: 0, background: "#dc2626", color: "white", cursor: "pointer" }}>
                    rejeitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={chatRef} style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {mensagens.length === 0 && (
            <div style={{ opacity: 0.55, fontSize: 13, lineHeight: 1.7 }}>
              Converse com a Mind. Exemplos:<br />
              · o que é pendente aéreo?<br />
              · quais convidados estão estourando o SLA?<br />
              · cliente quer alterar o controle de salas<br />
              · adicionar nó modulo "Rooming List"<br />
              · brainstorm: como reduzir atrasos no aéreo? <i style={{ opacity: 0.6 }}>(Área do Criador)</i><br />
              · o que quebra se eu mexer no check-in NFC?<br />
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
        <footer style={{ padding: 12, borderTop: "1px solid #232a45", display: "flex", gap: 8, alignItems: "center" }}>
          {foco && (
            <span title={`as perguntas vão com o contexto do nó ${foco.id}`}
              style={{ fontSize: 12, padding: "6px 10px", borderRadius: 16, background: "#3b3f8f",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", maxWidth: 140 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>🎯 {foco.titulo}</span>
              <span onClick={() => setFoco(null)} style={{ cursor: "pointer", opacity: 0.7 }}>✕</span>
            </span>
          )}
          <input value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
            placeholder={foco ? `Pergunte sobre "${foco.titulo}"…` : "Fale com a Mind…"}
            style={{ flex: 1, padding: 10, borderRadius: 8, background: "#161c33", color: "#e6e9f0", border: "1px solid #2c3558" }} />
          <button onClick={() => enviar()} disabled={pensando}
            style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#6366f1", color: "white", cursor: "pointer" }}>
            ➤
          </button>
        </footer>
      </section>
    </main>
  );
}
