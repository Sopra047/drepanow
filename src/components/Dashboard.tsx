"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import LeftPanel from "@/components/LeftPanel";
import ZonePanel from "@/components/ZonePanel";
import ChartsSection from "@/components/ChartsSection";
import ChatPanel from "@/components/ChatPanel";
import ReportModal from "@/components/ReportModal";
import { fmtD } from "@/lib/format";
import { defaultFilters } from "@/lib/zones";
import { filtersToQuery } from "@/lib/query";
import { reviveRecord, reviveZone } from "@/lib/parseApi";
import type { Filters, UserRole } from "@/types/record";
import type { RecordsResponse, ZonesResponse } from "@/types/api";

const MapPanel = dynamic(() => import("@/components/MapPanel"), { ssr: false });

export default function Dashboard({ initialRole }: { initialRole: UserRole }) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [data, setData] = useState<ZonesResponse | null>(null);
  const [records, setRecords] = useState<ReturnType<typeof reviveRecord>[]>([]);
  const [flySignal, setFlySignal] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [askSignal, setAskSignal] = useState<string | null>(null);

  useEffect(() => {
    // Lecture de la préférence sauvegardée au montage (léger flash accepté ;
    // cf. react.dev/learn/you-might-not-need-an-effect — cas "lire un stockage externe").
    const saved = localStorage.getItem("drp-theme") as "light" | "dark" | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("drp-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("chat-open", chatOpen);
  }, [chatOpen]);

  // Échap ferme le tiroir de chat ou la modale de rapport — cohérent partout,
  // peu importe la taille d'écran (corrige le bouton « fermer » qui ne répondait pas).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setChatOpen(false);
        setReportOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const queryKey = useMemo(() => JSON.stringify(filtersToQuery(filters)), [filters]);

  useEffect(() => {
    const q = new URLSearchParams(filtersToQuery(filters));
    fetch(`/api/zones?${q.toString()}`)
      .then((r) => r.json())
      .then((d: ZonesResponse) => setData({ ...d, zones: d.zones.map(reviveZone) }));
    fetch(`/api/records?${q.toString()}`)
      .then((r) => r.json())
      .then((d: RecordsResponse) => setRecords(d.records.map(reviveRecord)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const selectedZone = useMemo(() => data?.zones.find((z) => z.k === filters.sel) ?? null, [data, filters.sel]);

  const selectZone = useCallback((k: string) => {
    setFilters((f) => ({ ...f, sel: k }));
    setFlySignal((s) => s + 1);
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setRole("lecteur");
  }

  const srcLabel = data
    ? `Registre ${data.source.hospitals.join(", ") || "importé"} · ${data.source.exploitable} tests · mis à jour le ${fmtD(data.source.lastDate)}`
    : "Chargement du registre…";

  function openReportFor() {
    setReportOpen(true);
  }

  function openChatWithAsk() {
    setChatOpen(true);
  }

  return (
    <div id="app">
      <Header
        role={role}
        view="dash"
        srcLabel={srcLabel}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onOpenReport={openReportFor}
        onOpenChat={() => setChatOpen((v) => !v)}
        onLogout={logout}
      />

      {/* Carte plein écran : filtres, indicateurs et détail de zone flottent par-dessus. */}
      <main className="dash">
        <MapErrorBoundary>
          <MapPanel zones={data?.zones ?? []} selectedKey={filters.sel} onSelect={selectZone} flyToSignal={flySignal} />
        </MapErrorBoundary>

        <div className="mkpis-float">
          <div>
            <b style={{ color: "var(--ss)" }}>{data?.stats.ss ?? 0}</b>
            <span>Cas S/S</span>
          </div>
          <div>
            <b style={{ color: "var(--as)" }}>{data?.stats.as ?? 0}</b>
            <span>Porteurs A/S</span>
          </div>
          <div>
            <b style={{ color: "var(--hi)" }}>{data?.stats.hot ?? 0}</b>
            <span>Micro-zones</span>
          </div>
        </div>

        <div className="ov-stack">
          <LeftPanel data={data} filters={filters} onChange={setFilters} />
          {selectedZone && (
            <ZonePanel
              zone={selectedZone}
              role={role}
              onClose={() => setFilters((f) => ({ ...f, sel: null }))}
              onWhy={() => {
                setAskSignal(`Explique pourquoi ${selectedZone.name} (${selectedZone.localite}) est un hotspot`);
                openChatWithAsk();
              }}
              onPlan={() => {
                setAskSignal(
                  `Propose un plan de sensibilisation pour les porteurs A/S dans le quartier ${selectedZone.name} (${selectedZone.localite})`
                );
                openChatWithAsk();
              }}
              onReport={openReportFor}
            />
          )}
        </div>

        <button className="scrim" aria-label="Fermer l'assistant" onClick={() => setChatOpen(false)} />
        <ChatPanel
          role={role}
          filters={filters}
          selectedZone={selectedZone}
          exploitableCount={data?.source.exploitable ?? 0}
          onUnselectZone={() => setFilters((f) => ({ ...f, sel: null }))}
          onClose={() => setChatOpen(false)}
          pendingAsk={askSignal}
          onAsked={() => setAskSignal(null)}
        />
      </main>

      {/* Graphiques et registre, sous la carte, en défilement normal de page. */}
      <section className="below-map">
        <ChartsSection
          records={records}
          zones={data?.zones ?? []}
          type={filters.type}
          selectedKey={filters.sel}
          onSelectZone={selectZone}
        />
      </section>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        filters={filters}
        zones={data?.zones ?? []}
        selectedZone={selectedZone}
      />
    </div>
  );
}
