"use client";

import { fmtD, genoLabel } from "@/lib/format";
import { LVL } from "@/lib/zones";
import type { UserRole, Zone } from "@/types/record";

interface Props {
  zone: Zone | null;
  role: UserRole;
  onClose: () => void;
  onWhy: () => void;
  onPlan: () => void;
  onReport: () => void;
}

export default function ZonePanel({ zone, role, onClose, onWhy, onPlan, onReport }: Props) {
  if (!zone) return null;
  const can = role !== "lecteur";
  const ages = zone.recs.map((r) => r.age).filter((a): a is number => a != null);
  const ctx: Record<string, number> = {};
  zone.recs.forEach((r) => (ctx[r.contexte] = (ctx[r.contexte] || 0) + 1));
  const sy = zone.recs.filter((r) => r.geno === "SS" && r.symp === "Oui").length;
  const lastT = zone.recs.reduce<Date | null>((m, r) => (r.dateTest && (!m || r.dateTest > m) ? r.dateTest : m), null);
  const lvl = LVL[zone.lvl];

  return (
    <div className="zone-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div className="sub">{zone.localite} · District de Foumban</div>
          <h3>{zone.name}</h3>
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          Fermer
        </button>
      </div>
      <span
        className="lvl"
        style={{
          alignSelf: "flex-start",
          background: `color-mix(in oklch, ${lvl.c} 18%, transparent)`,
          color: zone.lvl === "lo" ? "var(--ink)" : lvl.c,
        }}
      >
        <i className="dot" style={{ background: lvl.c }} />
        {lvl.t}
      </span>
      <div className="zstats">
        <div>
          <span className="label">S/S</span>
          <b style={{ color: "var(--ss)" }}>{zone.ss}</b>
        </div>
        <div>
          <span className="label">A/S</span>
          <b style={{ color: "var(--as)" }}>{zone.as}</b>
        </div>
        <div>
          <span className="label">Score</span>
          <b>{zone.ss * 3 + zone.as}</b>
        </div>
      </div>
      <dl className="kv">
        <dt>Tests dans le registre</dt>
        <dd className="mono">{zone.n}</dd>
        <dt>S/S symptomatiques</dt>
        <dd className="mono">
          {sy} / {zone.ss}
        </dd>
        <dt>Âges</dt>
        <dd className="mono">{ages.length ? `${Math.min(...ages)}–${Math.max(...ages)} ans` : "—"}</dd>
        <dt>Contextes</dt>
        <dd>{Object.entries(ctx).map(([k, v]) => `${k} (${v})`).join(", ")}</dd>
        <dt>Dernier test</dt>
        <dd className="mono">{fmtD(lastT)}</dd>
      </dl>
      <table className="mini">
        <thead>
          <tr>
            <th>Code</th>
            <th>Âge</th>
            <th>Sexe</th>
            <th>Géno.</th>
            <th>Contexte</th>
          </tr>
        </thead>
        <tbody>
          {zone.recs.map((r) => (
            <tr key={r.code}>
              <td className="mono">{r.code}</td>
              <td className="mono">{r.age ?? "—"}</td>
              <td>{r.sexe}</td>
              <td>
                <span className={`geno ${r.geno}`}>
                  {genoLabel(r.geno)}
                </span>
              </td>
              <td>{r.contexte}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="zacts">
        <button className="btn sm primary" onClick={onWhy}>
          Pourquoi ce hotspot ?
        </button>
        <button className="btn sm" onClick={onPlan}>
          Plan de sensibilisation A/S
        </button>
        {can && (
          <button className="btn sm" onClick={onReport}>
            Rapport PDF
          </button>
        )}
      </div>
    </div>
  );
}
