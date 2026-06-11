"use client";
import { useState } from "react";

const USUARIOS = ["rafael", "diretor-exemplo", "rh-exemplo", "operador-exemplo"];

export default function Home() {
  const [usuario, setUsuario] = useState("operador-exemplo");
  const [texto, setTexto] = useState("o que é pendente aéreo?");
  const [resp, setResp] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  async function perguntar() {
    setCarregando(true);
    setResp(null);
    try {
      const r = await fetch("/api/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, texto }),
      });
      setResp(await r.json());
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontWeight: 700 }}>🧠 Mind</h1>
      <p style={{ opacity: 0.7 }}>Fase 1 — orquestrador mínimo (Escuta → Orquestrador → Fala)</p>

      <label style={{ display: "block", marginTop: 16 }}>Quem está perguntando</label>
      <select value={usuario} onChange={(e) => setUsuario(e.target.value)}
        style={{ width: "100%", padding: 8, borderRadius: 8 }}>
        {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>

      <label style={{ display: "block", marginTop: 16 }}>Pergunta</label>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
        style={{ width: "100%", padding: 8, borderRadius: 8 }} />

      <button onClick={perguntar} disabled={carregando}
        style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, border: 0,
          background: "#6366f1", color: "white", cursor: "pointer" }}>
        {carregando ? "Pensando…" : "Perguntar à Mind"}
      </button>

      {resp && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "#161c33" }}>
          <div style={{ fontSize: 18 }}>{resp.resposta}</div>
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
            nível: <b>{resp.nivel}</b> · permitido: <b>{String(resp.permitido)}</b> ·
            modo: <b>{resp.modo}</b> · contexto: <b>{(resp.contexto || []).join(", ") || "—"}</b>
          </div>
        </div>
      )}
    </main>
  );
}
