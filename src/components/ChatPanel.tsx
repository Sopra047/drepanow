"use client";

import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { SUGGESTIONS } from "@/lib/ai";
import type { ChatMessage } from "@/types/api";
import type { Filters, UserRole, Zone } from "@/types/record";
import { filtersToQuery } from "@/lib/query";

interface Props {
  role: UserRole;
  filters: Filters;
  selectedZone: Zone | null;
  exploitableCount: number;
  onUnselectZone: () => void;
  onClose: () => void;
  pendingAsk?: string | null;
  onAsked?: () => void;
}

export default function ChatPanel({ role, filters, selectedZone, exploitableCount, onUnselectZone, onClose, pendingAsk, onAsked }: Props) {
  const [hist, setHist] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [hist, busy]);

  async function send(base: ChatMessage[], q: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: base.filter((m) => !m.err).slice(-10),
          filters: filtersToQuery(filters),
          max_tokens: 1400,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setHist([...base, { role: "assistant", content: data.content, q }]);
    } catch (e) {
      setHist([
        ...base,
        { role: "assistant", content: `Une erreur est survenue. ${e instanceof Error ? e.message : ""} Réessayez dans un instant.`, err: true, q },
      ]);
    }
    setBusy(false);
  }

  async function ask(q: string) {
    if (busy || !q.trim()) return;
    const base = [...hist, { role: "user" as const, content: q.trim() }];
    setHist(base);
    send(base, q.trim());
  }

  /** Retente la dernière question sans dupliquer la bulle utilisateur : on repart
   * de l'historique juste avant la réponse en échec (à l'index `i`). */
  function retry(i: number) {
    if (busy) return;
    const base = hist.slice(0, i);
    const q = hist[i].q ?? "";
    send(base, q);
  }

  useEffect(() => {
    // Commande reçue du panneau de zone (« Pourquoi ce hotspot ? » etc.) via un
    // signal porté par les props — pont volontaire entre composants, pas un calcul
    // dérivable du rendu : d'où l'effet plutôt qu'un callback direct.
    if (pendingAsk) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      ask(pendingAsk);
      onAsked?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  const localite = selectedZone?.localite ?? "Foumban";

  return (
    <aside className="chat">
      <div className="chd">
        <div className="t">
          <h2>Assistant IA</h2>
          <span className="live">
            <i /> Données filtrées
          </span>
          <button className="iconbtn" style={{ marginLeft: 4 }} onClick={onClose} title="Fermer l'assistant">
            ×
          </button>
        </div>
        <div className="ctx">
          <span className="chip">
            {filters.locs ? filters.locs.size : "Toutes les"} localité(s) · {filters.type === "both" ? "S/S + A/S" : filters.type}
          </span>
          {selectedZone && (
            <span className="chip">
              Zone : {selectedZone.name}{" "}
              <button onClick={onUnselectZone} title="Retirer">
                ×
              </button>
            </span>
          )}
          {hist.length > 0 && (
            <button className="chip" style={{ cursor: "pointer" }} onClick={() => setHist([])}>
              Nouvelle conversation
            </button>
          )}
        </div>
      </div>

      <div className="msgs" ref={scrollRef}>
        {hist.length === 0 ? (
          <>
            <div className="msg a">
              <span className="who">Assistant</span>
              <div className="bub">
                <p>
                  Bonjour. J&apos;analyse les <strong>{exploitableCount} tests</strong> du registre selon vos filtres. Choisissez une question ou
                  écrivez la vôtre.
                </p>
              </div>
            </div>
            <div className="sugg">
              {SUGGESTIONS(localite).map((s) => (
                <button key={s} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          hist.map((m, i) =>
            m.role === "user" ? (
              <div className="msg u" key={i}>
                <div className="bub">{m.content}</div>
              </div>
            ) : (
              <div className="msg a" key={i}>
                <span className="who">Assistant</span>
                <div className={`bub ${m.err ? "bad" : ""}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                <div className="macts">
                  {m.err ? (
                    <button className="btn ghost sm" onClick={() => retry(i)} disabled={busy}>
                      Réessayer
                    </button>
                  ) : (
                    <>
                      {m.q && (
                        <button className="btn ghost sm" onClick={() => retry(i)} disabled={busy} title="Reposer la même question">
                          Régénérer
                        </button>
                      )}
                      {role !== "lecteur" && (
                        <button className="btn ghost sm" onClick={() => exportPdf(m.content, m.q)}>
                          Exporter en PDF
                        </button>
                      )}
                      <button
                        className="btn ghost sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(m.content);
                          setCopiedAt(i);
                          setTimeout(() => setCopiedAt((c) => (c === i ? null : c)), 1500);
                        }}
                      >
                        {copiedAt === i ? "Copié" : "Copier"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )
        )}
        {busy && (
          <div className="msg a">
            <span className="who">Assistant · analyse en cours</span>
            <div className="bub">
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        className="cin"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
          setInput("");
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
          placeholder="Posez une question…"
        />
        <button className="btn primary sm" type="submit" disabled={busy}>
          Envoyer
        </button>
      </form>
    </aside>
  );
}

function exportPdf(content: string, title?: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const now = new Date();
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title ?? "Réponse de l'assistant IA"}</title>
<style>
  body{font:14px/1.6 system-ui,sans-serif;color:#1c2333;padding:40px 52px;max-width:720px;margin:0 auto}
  .m{font:500 10.5px ui-monospace,monospace;color:#5b6478;border-bottom:2px solid #1d3a8a;padding-bottom:10px;margin-bottom:16px}
  h1{font-size:18px;margin:0 0 18px;color:#14204a}
  h4{font-size:14px;color:#14204a;margin:16px 0 6px}
  ul,ol{padding-left:18px;margin:0 0 8px} p{margin:0 0 8px}
</style></head><body>
<div class="m">DREPANOW AI · ${now.toLocaleDateString("fr-FR")} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
${title ? `<h1>${title}</h1>` : ""}
${renderMarkdown(content)}
</body></html>`);
  w.document.close();
  w.print();
}
