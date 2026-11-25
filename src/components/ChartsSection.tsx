"use client";

import { useMemo, useState } from "react";
import { fmtD, genoLabel, MOIS } from "@/lib/format";
import { LVL } from "@/lib/zones";
import type { DataType, PatientRecord, Zone } from "@/types/record";

interface Props {
  records: PatientRecord[];
  zones: Zone[];
  type: DataType;
  selectedKey: string | null;
  onSelectZone: (k: string) => void;
}

function EvolutionChart({ records }: { records: PatientRecord[] }) {
  const cols = useMemo(() => {
    const b: Record<number, { ss: number; as: number }> = {};
    const old = { ss: 0, as: 0 };
    records.forEach((r) => {
      if (!r.dateTest) return;
      const y = r.dateTest.getUTCFullYear();
      const m = r.dateTest.getUTCMonth();
      if (y < 2026) {
        old[r.geno === "SS" ? "ss" : "as"]++;
        return;
      }
      const k = y * 12 + m;
      const bucket = b[k] || (b[k] = { ss: 0, as: 0 });
      bucket[r.geno === "SS" ? "ss" : "as"]++;
    });
    const keys = Object.keys(b).map(Number);
    const out: Array<{ l: string; ss: number; as: number }> = [];
    if (old.ss + old.as) out.push({ l: "< 2026", ...old });
    if (keys.length) {
      for (let k = Math.min(...keys); k <= Math.max(...keys); k++) {
        out.push({ l: MOIS[k % 12], ...(b[k] || { ss: 0, as: 0 }) });
      }
    }
    return out;
  }, [records]);

  const mx = Math.max(1, ...cols.map((c) => c.ss + c.as));

  return (
    <div className="card">
      <div className="hd">
        <h2>Évolution des tests positifs</h2>
        <div className="keys">
          <span>
            <i className="dot" style={{ background: "var(--ss)" }} /> S/S
          </span>
          <span>
            <i className="dot" style={{ background: "var(--as)" }} /> A/S
          </span>
        </div>
      </div>
      {cols.length ? (
        <>
          <div className="cols">
            {cols.map((c, i) => (
              <div className="col" key={i}>
                <span className="t">{c.ss + c.as || ""}</span>
                <div className="b" style={{ height: `${((c.ss + c.as) / mx) * 100}%` }}>
                  <i style={{ flex: c.ss, background: "var(--ss)" }} />
                  <i style={{ flex: c.as, background: "var(--as)" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="xl" style={{ marginTop: 5 }}>
            {cols.map((c, i) => (
              <span key={i}>{c.l}</span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--muted)" }}>Aucune donnée sur la période.</div>
      )}
    </div>
  );
}

function PyramidChart({ records }: { records: PatientRecord[] }) {
  const bins: Array<[number, number]> = [
    [0, 4],
    [5, 14],
    [15, 24],
    [25, 34],
    [35, 44],
    [45, 200],
  ];
  const pr = bins.map(([a, z]) => ({
    l: z > 100 ? `${a}+` : `${a}–${z}`,
    m: records.filter((r) => r.sexe === "M" && r.age != null && r.age >= a && r.age <= z).length,
    f: records.filter((r) => r.sexe === "F" && r.age != null && r.age >= a && r.age <= z).length,
  }));
  const pm = Math.max(1, ...pr.map((p) => Math.max(p.m, p.f)));

  return (
    <div className="card">
      <div className="hd">
        <h2>Répartition par âge et sexe</h2>
        <div className="keys">
          <span>
            <i className="dot" style={{ background: "var(--as)" }} /> Masculin
          </span>
          <span>
            <i className="dot" style={{ background: "var(--ss)" }} /> Féminin
          </span>
        </div>
      </div>
      <div className="pyr">
        {pr
          .slice()
          .reverse()
          .map((p) => (
            <div key={p.l} style={{ display: "contents" }}>
              <div className="m">
                <span className="c">{p.m || ""}</span>
                <i style={{ width: `${(p.m / pm) * 100}%`, background: "var(--as)" }} />
              </div>
              <div className="lab">{p.l}</div>
              <div className="f">
                <i style={{ width: `${(p.f / pm) * 100}%`, background: "var(--ss)" }} />
                <span className="c">{p.f || ""}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Top10({ zones, selectedKey, onSelectZone }: { zones: Zone[]; selectedKey: string | null; onSelectZone: (k: string) => void }) {
  const zs = zones.slice(0, 10);
  const zm = Math.max(1, ...zs.map((z) => z.ss * 3 + z.as));
  return (
    <div className="card" style={{ gridColumn: "1/-1" }}>
      <div className="hd">
        <h2>Top 10 des quartiers</h2>
      </div>
      <div className="top10">
        <div className="trow thd">
          <span>#</span>
          <span>Quartier</span>
          <span>Répartition</span>
          <span style={{ textAlign: "right" }}>S/S</span>
          <span style={{ textAlign: "right" }}>A/S</span>
          <span />
        </div>
        {zs.map((z, i) => (
          <button key={z.k} className={`trow ${selectedKey === z.k ? "on" : ""}`} onClick={() => onSelectZone(z.k)}>
            <span className="rk">{String(i + 1).padStart(2, "0")}</span>
            <span className="nm">
              <b>{z.name}</b>
              <span>{z.localite}</span>
            </span>
            <span className="bar" style={{ width: `${((z.ss * 3 + z.as) / zm) * 100}%` }}>
              <i style={{ flex: z.ss * 3, background: "var(--ss)" }} />
              <i style={{ flex: z.as, background: "var(--as)" }} />
            </span>
            <span className="num" style={{ color: "var(--ss)" }}>
              {z.ss}
            </span>
            <span className="num" style={{ color: "var(--as)" }}>
              {z.as}
            </span>
            <i className="dot" style={{ background: LVL[z.lvl].c }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Registry({ records }: { records: PatientRecord[] }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return records;
    return records.filter((r) => `${r.quartier} ${r.code} ${r.localite} ${r.geno}`.toLowerCase().includes(needle));
  }, [records, q]);

  return (
    <div className="card" style={{ gridColumn: "1/-1" }}>
      <div className="hd">
        <h2>Registre anonymisé</h2>
        <input className="search" placeholder="Filtrer : quartier, code…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="reg">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Date du test</th>
              <th>Âge</th>
              <th>Sexe</th>
              <th>Quartier</th>
              <th>Localité</th>
              <th>Génotype</th>
              <th>Contexte</th>
              <th>Sympt.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td className="mono">{fmtD(r.dateTest)}</td>
                <td className="mono">{r.age ?? "—"}</td>
                <td>{r.sexe}</td>
                <td>{r.quartier}</td>
                <td>{r.localite}</td>
                <td>
                  <span className={`geno ${r.geno}`}>
                    {genoLabel(r.geno)}
                  </span>
                </td>
                <td>{r.contexte}</td>
                <td>{r.symp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ChartsSection({ records, zones, type, selectedKey, onSelectZone }: Props) {
  const typedRecords = records.filter((r) => (type === "both" ? r.geno === "SS" || r.geno === "AS" : r.geno === type));
  return (
    <div className="charts cgrid">
      <EvolutionChart records={typedRecords} />
      <PyramidChart records={typedRecords} />
      <Top10 zones={zones} selectedKey={selectedKey} onSelectZone={onSelectZone} />
      <Registry records={records} />
    </div>
  );
}
