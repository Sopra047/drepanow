"use client";

import { useState } from "react";
import type { Filters } from "@/types/record";
import type { ZonesResponse } from "@/types/api";

interface Props {
  data: ZonesResponse | null;
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function LeftPanel({ data, filters, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const st = data?.stats;
  const localites = data?.localites ?? [];
  const activeLocs = filters.locs ?? new Set(localites.map(([l]) => l));

  const toggleLoc = (name: string) => {
    const next = new Set(filters.locs ?? localites.map(([l]) => l));
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange({ ...filters, locs: next });
  };

  return (
    <div className={`ov-card ${open ? "open" : ""}`}>
      <button className="ov-hd" onClick={() => setOpen((v) => !v)}>
        <h2>Indicateurs et filtres</h2>
        <i>▾</i>
      </button>
      {open && (
        <div className="ov-body">
          <div className="kpis">
            <div className="kpi ss">
              <div className="label">Cas S/S</div>
              <div className="v">{st?.ss ?? 0}</div>
              <div className="s">âge médian {st?.medSS ?? "—"} ans</div>
            </div>
            <div className="kpi as">
              <div className="label">Porteurs A/S</div>
              <div className="v">{st?.as ?? 0}</div>
              <div className="s">{st && st.n ? Math.round((st.as / st.n) * 100) : 0} % des tests</div>
            </div>
            <div className="kpi hz wide">
              <div className="label">Micro-zones prioritaires</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div className="v">{st?.hot ?? 0}</div>
                <div className="s">sur {st?.zones ?? 0} quartiers concernés</div>
              </div>
            </div>
            <div className="kpi wide" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="label">Tests analysés</div>
                <div className="v" style={{ fontSize: 18 }}>
                  {st?.n ?? 0}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">S/S symptomatiques</div>
                <div className="v" style={{ fontSize: 18 }}>
                  {st?.sympSS ?? 0} %
                </div>
              </div>
            </div>
          </div>

          <div className="fgroup">
            <div className="label">Zone géographique</div>
            <select defaultValue="ouest">
              <option value="toutes">Toutes les régions</option>
              <option value="ouest">Ouest</option>
            </select>
            <select defaultValue="fb">
              <option value="fb">District de santé de Foumban</option>
            </select>
          </div>

          <div className="fgroup">
            <div className="label">Localité</div>
            <div className="checks">
              {localites.map(([l, n]) => (
                <label className="check" key={l}>
                  <input type="checkbox" checked={activeLocs.has(l)} onChange={() => toggleLoc(l)} />
                  {l}
                  <span className="n num">{n}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="fgroup">
            <div className="label">Type de données</div>
            <div className="seg">
              {(["both", "SS", "AS"] as const).map((v) => (
                <button key={v} className={filters.type === v ? "on" : ""} onClick={() => onChange({ ...filters, type: v })}>
                  {v === "both" ? "Les deux" : v}
                </button>
              ))}
            </div>
          </div>

          <div className="fgroup">
            <div className="label">Période (date du test)</div>
            <select
              value={filters.period}
              onChange={(e) => onChange({ ...filters, period: e.target.value as Filters["period"] })}
            >
              <option value="all">Toute la période</option>
              <option value="2026">Année 2026</option>
              <option value="90">90 derniers jours</option>
              <option value="30">30 derniers jours</option>
            </select>
          </div>

          <button
            className="btn sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => onChange({ type: "both", period: "all", locs: null, sel: null })}
          >
            Réinitialiser les filtres
          </button>

          <div className="note">
            <div className="label" style={{ marginBottom: 6 }}>
              Qualité des données
            </div>
            {data ? (
              <>
                {data.source.exploitable} fiches exploitables sur {data.source.rows}
                {data.source.inferred ? ` · ${data.source.inferred} localité(s) déduite(s)` : ""}. Source :{" "}
                {data.source.src}.
              </>
            ) : (
              "Chargement…"
            )}
          </div>
        </div>
      )}
    </div>
  );
}
