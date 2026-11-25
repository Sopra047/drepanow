"use client";

import { useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { REPORT_TYPES } from "@/lib/ai";
import { filtersToQuery } from "@/lib/query";
import type { Filters, Zone } from "@/types/record";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  zones: Zone[];
  selectedZone: Zone | null;
}

type Step = "config" | "loading" | "preview" | "error";

export default function ReportModal({ open, onClose, filters, zones, selectedZone }: Props) {
  const [step, setStep] = useState<Step>("config");
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]["id"]>("action");
  const [scope, setScope] = useState(selectedZone?.k ?? "");
  const [kits, setKits] = useState("");
  const [doc, setDoc] = useState<{ title: string; scope: string; content: string; totals: Record<string, number | null>; topZones: Array<{ quartier: string; localite: string; SS: number; AS: number; niveau: string }> } | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  async function generate() {
    setStep("loading");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, scope: scope || undefined, kits: kits || undefined, filters: filtersToQuery(filters) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la génération");
      const rtype = REPORT_TYPES.find((r) => r.id === type)!;
      setDoc({ title: rtype.t, scope: data.scope, content: data.content, totals: data.totals, topZones: data.topZones });
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la génération");
      setStep("error");
    }
  }

  function printDoc() {
    window.print();
  }

  const now = new Date();

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbox">
        <div className="mhd">
          <h2>{step === "preview" ? "Aperçu du rapport" : "Générer un rapport"}</h2>
          <div style={{ flex: 1 }} />
          {step === "preview" && (
            <button className="btn sm primary" onClick={printDoc}>
              Télécharger en PDF
            </button>
          )}
          <button className="btn sm ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="mbody">
          {step === "config" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="field">
                <span className="label">Type de rapport</span>
                <div className="opts">
                  {REPORT_TYPES.map((r) => (
                    <label className="role" key={r.id}>
                      <input type="radio" name="rt" checked={type === r.id} onChange={() => setType(r.id)} />
                      <div>
                        <b>{r.t}</b>
                        <span>{r.d}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="label">Périmètre</span>
                <select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="">District de santé de Foumban (filtres actuels)</option>
                  {zones.map((z) => (
                    <option key={z.k} value={z.k}>
                      {z.name} — {z.localite}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Kits de dépistage disponibles (optionnel)</span>
                <input type="number" min={0} placeholder="ex. 200" value={kits} onChange={(e) => setKits(e.target.value)} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn" onClick={onClose}>
                  Annuler
                </button>
                <button className="btn primary" onClick={generate}>
                  Générer le rapport
                </button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div style={{ padding: "50px 0", textAlign: "center", color: "var(--muted)" }}>
              <div className="typing" style={{ justifyContent: "center", marginBottom: 10 }}>
                <i />
                <i />
                <i />
              </div>
              Rédaction du rapport en cours…
            </div>
          )}

          {step === "error" && (
            <>
              <p className="bad">Échec de la génération : {error}</p>
              <button className="btn" onClick={() => setStep("config")}>
                Réessayer
              </button>
            </>
          )}

          {step === "preview" && doc && (
            <div className="doc" id="doc">
              <div className="dh">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="" />
                <div className="m">
                  DREPANOW AI · RAPPORT GÉNÉRÉ
                  <br />
                  {now.toLocaleDateString("fr-FR")} {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <h1>{doc.title}</h1>
              <div style={{ color: "#5b6478" }}>{doc.scope} · Région de l&apos;Ouest, département du Noun</div>
              <div className="meta">
                <div>
                  Tests analysés<b>{doc.totals.tests}</b>
                </div>
                <div>
                  Cas S/S<b>{doc.totals.cas_SS}</b>
                </div>
                <div>
                  Porteurs A/S<b>{doc.totals.porteurs_AS}</b>
                </div>
                <div>
                  Micro-zones prioritaires<b>{doc.totals.micro_zones_prioritaires}</b>
                </div>
              </div>
              <h4>Quartiers au score le plus élevé</h4>
              <table>
                <thead>
                  <tr>
                    <th>Quartier</th>
                    <th>Localité</th>
                    <th>S/S</th>
                    <th>A/S</th>
                    <th>Priorité</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.topZones.map((z) => (
                    <tr key={z.quartier + z.localite}>
                      <td>{z.quartier}</td>
                      <td>{z.localite}</td>
                      <td>{z.SS}</td>
                      <td>{z.AS}</td>
                      <td>{z.niveau.replace("Priorité ", "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }} />
              <div className="ft">
                <span>Source : registre importé · données anonymisées</span>
                <span>Texte généré automatiquement à partir des données, à valider par le responsable de district</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
