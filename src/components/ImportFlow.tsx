"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldMapping, IncompleteRow, PatientRecord } from "@/types/record";

interface Analysis {
  src: string;
  rows: number;
  exploitable: number;
  incomplete: IncompleteRow[];
  mapping: FieldMapping[];
  pii: string[];
  ignored: string[];
  inferred: number;
  unknownGeo: string[];
  counts: { SS: number; AS: number; other: number };
  pendingRecords: PatientRecord[];
}

export default function ImportFlow() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [integrated, setIntegrated] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState<{ attempted: number; resolved: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = analyzing || integrating;

  async function handleFile(file: File) {
    setAnalyzing(true);
    setError("");
    setIntegrated(null);
    setGeocoding(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible.");
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
      setAnalysis(null);
    }
    setAnalyzing(false);
  }

  async function confirmIntegration() {
    if (!analysis) return;
    setIntegrating(true);
    setError("");
    const res = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src: analysis.src, records: analysis.pendingRecords, inferred: analysis.inferred }),
    });
    const data = await res.json();
    setIntegrating(false);
    if (!res.ok) {
      setError(data.error || "Échec de l'intégration.");
      return;
    }
    setIntegrated(data.integrated);
    setGeocoding(data.geocoding ?? null);
  }

  const missingRequired = analysis?.mapping.filter((m) => m.req && !m.src) ?? [];
  const steps = [
    { label: "Fichier", done: !!analysis, active: analyzing },
    { label: "Correspondance des champs", done: !!analysis, active: false },
    { label: "Contrôle et anonymisation", done: !!analysis, active: false },
    { label: "Intégration", done: integrated != null, active: integrating },
  ];

  return (
    <div className="imp">
      <div className="wrap">
        <h1>Importer un registre d&apos;électrophorèse</h1>
        <a className="btn sm" href="/modele-registre-drepanow.csv" download style={{ alignSelf: "flex-start" }}>
          Télécharger le modèle CSV
        </a>

        <div className="steps">
          {steps.map((s, i) => (
            <div className={`step ${s.done ? "done" : ""} ${s.active ? "active" : ""}`} key={s.label}>
              <b>{i + 1}</b>
              {s.label}
              {s.active && " …"}
            </div>
          ))}
        </div>

        <div
          className={`drop ${dragOver ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <div className="ic">CSV/XLSX</div>
          <div style={{ flex: 1 }}>
            <div>Glissez-déposez un fichier .csv ou .xlsx, ou</div>
            <button className="btn sm" style={{ marginTop: 6 }} onClick={() => inputRef.current?.click()}>
              Choisir un fichier
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>

        {analyzing && <div className="card">Lecture et analyse du fichier…</div>}
        {integrating && (
          <div className="card">
            Intégration en cours…
            {analysis && analysis.unknownGeo.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Géolocalisation de {analysis.unknownGeo.length} nouveau(x) quartier(s) via OpenStreetMap — peut prendre
                quelques secondes (environ 1 seconde par quartier).
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="card">
            <b className="bad">Import impossible</b>
            <div>{error}</div>
          </div>
        )}

        {integrated != null && (
          <div className="card">
            <b className="ok">Intégration réussie</b>
            <div>
              {integrated} fiches intégrées au tableau de bord.{" "}
              <button className="btn sm" onClick={() => router.push("/")}>
                Voir le tableau de bord
              </button>
            </div>
            {geocoding && geocoding.attempted > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Géolocalisation automatique (OpenStreetMap) : {geocoding.resolved} / {geocoding.attempted} nouveau(x) quartier(s) positionné(s)
                {geocoding.resolved < geocoding.attempted
                  ? ` — ${geocoding.attempted - geocoding.resolved} non trouvé(s), affiché(s) avec une position approximative en attendant une correction manuelle.`
                  : "."}
              </div>
            )}
          </div>
        )}

        {analysis && integrated == null && (
          <>
            <div className="qgrid">
              <div className="card">
                <div className="label">Fiches exploitables</div>
                <div className="v mono" style={{ fontSize: 22 }}>
                  {analysis.exploitable} / {analysis.rows}
                </div>
              </div>
              <div className="card">
                <div className="label">Cas S/S</div>
                <div className="v mono" style={{ fontSize: 22, color: "var(--ss)" }}>
                  {analysis.counts.SS}
                </div>
              </div>
              <div className="card">
                <div className="label">Porteurs A/S</div>
                <div className="v mono" style={{ fontSize: 22, color: "var(--as)" }}>
                  {analysis.counts.AS}
                </div>
              </div>
              <div className="card">
                <div className="label">AA / SC / Autre</div>
                <div className="v mono" style={{ fontSize: 22 }}>
                  {analysis.counts.other}
                </div>
              </div>
            </div>

            {analysis.incomplete.length > 0 && (
              <div className="card">
                <h2>Fiches incomplètes exclues</h2>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                  {analysis.incomplete.map((r) => (
                    <li key={r.line}>
                      Ligne {r.line} : {r.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card">
              <h2>Correspondance des champs</h2>
              <table className="mini">
                <thead>
                  <tr>
                    <th>Champ Drepanow</th>
                    <th>Colonne source</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.mapping.map((m) => (
                    <tr key={m.k}>
                      <td>
                        {m.label}
                        {m.req && " *"}
                      </td>
                      <td className={m.src ? "ok" : "bad"}>{m.src ?? "manquant"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Anonymisation et contrôle</h2>
              <dl className="kv">
                <dt>Colonnes nominatives détectées (supprimées)</dt>
                <dd>{analysis.pii.length ? analysis.pii.join(", ") : "aucune"}</dd>
                <dt>Colonnes non importées (minimisation)</dt>
                <dd>{analysis.ignored.length ? analysis.ignored.join(", ") : "aucune"}</dd>
                <dt>Localités déduites</dt>
                <dd>{analysis.inferred}</dd>
                <dt>Quartiers à géolocaliser</dt>
                <dd>{analysis.unknownGeo.length ? analysis.unknownGeo.join(", ") : "aucun"}</dd>
              </dl>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
              {missingRequired.length > 0 && (
                <span className="bad" style={{ fontSize: 12.5 }}>
                  Champ(s) obligatoire(s) manquant(s) : {missingRequired.map((m) => m.label).join(", ")}
                </span>
              )}
              <button className="btn primary" disabled={missingRequired.length > 0 || loading} onClick={confirmIntegration}>
                {integrating ? "Intégration…" : "Intégrer au tableau de bord"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
