"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { LOC_CENTER, VIEWS } from "@/lib/geo";
import { LVL } from "@/lib/zones";
import type { Zone } from "@/types/record";

interface Props {
  zones: Zone[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  flyToSignal: number;
}

const LEVEL_VAR: Record<string, string> = { hi: "--hi", md: "--md", lo: "--lo" };

function cssVar(name: string) {
  if (typeof window === "undefined") return "#999";
  return getComputedStyle(document.body).getPropertyValue(name).trim() || "#999";
}

function CrumbsControl({ view, onGo }: { view: string; onGo: (v: string) => void }) {
  const items: [string, string][] = [
    ["cm", "Cameroun"],
    ["ouest", "Ouest"],
    ["noun", "Noun"],
    ["fb", "Foumban"],
  ];
  return (
    <div className="ov crumbs">
      {items.map(([k, t], i) => (
        <span key={k}>
          {i > 0 && <i>›</i>}
          <button className={view === k ? "on" : ""} onClick={() => onGo(k)}>
            {t}
          </button>
        </span>
      ))}
    </div>
  );
}

function CameroonOutline() {
  const map = useMap();
  const [ring, setRing] = useState<LatLngTuple[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("topojson-client").then((topojson) => {
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json")
        .then((r) => r.json())
        .then((t) => {
          if (cancelled) return;
          const features = (topojson.feature(t, t.objects.countries) as unknown as { features: Array<{ id: string; geometry: { type: string; coordinates: number[][][] | number[][][][] } }> }).features;
          const cm = features.find((f) => f.id === "120");
          if (!cm) return;
          const coords = cm.geometry.type === "Polygon" ? (cm.geometry.coordinates as number[][][]) : (cm.geometry.coordinates as number[][][][]).flat();
          const r: LatLngTuple[] = coords[0].map(([x, y]) => [y, x]);
          setRing(r);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [map]);

  if (!ring) return null;
  const outer: LatLngTuple[] = [
    [-85, -180],
    [-85, 180],
    [85, 180],
    [85, -180],
  ];
  return (
    <>
      <Polygon
        positions={[outer, ring]}
        pathOptions={{ stroke: false, fillColor: cssVar("--mask"), fillOpacity: 0.55, interactive: false }}
      />
      <Polygon
        positions={[ring]}
        pathOptions={{ color: cssVar("--accent"), weight: 1.6, fill: false, dashArray: "4 3", interactive: false }}
      />
    </>
  );
}

function Markers({ zones, selectedKey, onSelect, zoom }: { zones: Zone[]; selectedKey: string | null; onSelect: (k: string) => void; zoom: number }) {
  if (zoom < 11) {
    const agg: Record<string, { localite: string; ss: number; as: number; score: number; ll: LatLngTuple; hi: number }> = {};
    zones.forEach((z) => {
      const a =
        agg[z.localite] ||
        (agg[z.localite] = { localite: z.localite, ss: 0, as: 0, score: 0, ll: (LOC_CENTER[z.localite] || z.ll) as LatLngTuple, hi: 0 });
      a.ss += z.ss;
      a.as += z.as;
      a.score += z.score;
      if (z.lvl === "hi") a.hi++;
    });
    return (
      <>
        {Object.values(agg).map((a) => {
          const lv = a.hi ? "hi" : a.score >= 3 ? "md" : "lo";
          const r = 7 + Math.sqrt(a.score) * (zoom < 8 ? 2.2 : 3.2);
          return (
            <CircleMarker
              key={a.localite}
              center={a.ll}
              radius={r}
              pathOptions={{ color: "#fff", weight: 1.5, fillColor: cssVar(LEVEL_VAR[lv]), fillOpacity: 0.85 }}
            >
              <Tooltip className="zt" direction="top">
                <b>{a.localite}</b>
                <br />
                <span className="mono">
                  S/S {a.ss} · A/S {a.as}
                </span>
                {a.hi ? (
                  <>
                    <br />
                    {a.hi} micro-zone(s) prioritaire(s)
                  </>
                ) : null}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  return (
    <>
      {zones
        .slice()
        .reverse()
        .map((z) => {
          const r = 6 + Math.sqrt(z.score) * 4.2;
          const sel = selectedKey === z.k;
          return (
            <Fragment key={z.k}>
              {z.lvl === "hi" && (
                <CircleMarker center={z.ll} radius={r + 9} pathOptions={{ stroke: false, fillColor: cssVar(LEVEL_VAR[z.lvl]), fillOpacity: 0.18 }} />
              )}
              <CircleMarker
                center={z.ll}
                radius={r}
                pathOptions={{
                  color: sel ? cssVar("--ink") : "#fff",
                  weight: sel ? 3 : 1.5,
                  fillColor: cssVar(LEVEL_VAR[z.lvl]),
                  fillOpacity: 0.9,
                }}
                eventHandlers={{ click: () => onSelect(z.k) }}
              >
                <Tooltip className="zt" direction="top" offset={[0, -r]}>
                  <b>{z.name}</b> · {z.localite}
                  <br />
                  <span className="mono">
                    S/S {z.ss} · A/S {z.as}
                  </span>
                </Tooltip>
                {zoom >= 14 && (z.lvl !== "lo" || zoom >= 15) && (
                  <Tooltip className="lbl" permanent direction="right" offset={[r + 2, 0]}>
                    {z.name}
                  </Tooltip>
                )}
              </CircleMarker>
            </Fragment>
          );
        })}
    </>
  );
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

function FlyController({ zones, selectedKey, signal }: { zones: Zone[]; selectedKey: string | null; signal: number }) {
  const map = useMap();
  const prevSignal = useRef(signal);
  useEffect(() => {
    if (signal === prevSignal.current) return;
    prevSignal.current = signal;
    const z = zones.find((z) => z.k === selectedKey);
    if (z && map.getZoom() < 13) map.flyTo(z.ll, 14.5, { duration: 0.7 });
  }, [signal, zones, selectedKey, map]);
  return null;
}

export default function MapPanel({ zones, selectedKey, onSelect, flyToSignal }: Props) {
  const [zoom, setZoom] = useState(14);
  const [view, setView] = useState<keyof typeof VIEWS>("fb");

  const cnt = { hi: 0, md: 0, lo: 0 } as Record<string, number>;
  zones.forEach((z) => (cnt[z.lvl] = (cnt[z.lvl] || 0) + 1));

  return (
    <div className="mapwrap">
      <MapContainer
        center={[5.7266, 10.901]}
        zoom={14}
        minZoom={5}
        maxZoom={17}
        zoomSnap={0.25}
        zoomControl
        style={{ position: "absolute", inset: 0 }}
        bounds={VIEWS.fb as unknown as LatLngBoundsExpression}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
        <CameroonOutline />
        <Markers zones={zones} selectedKey={selectedKey} onSelect={onSelect} zoom={zoom} />
        <ZoomWatcher onZoom={setZoom} />
        <FlyController zones={zones} selectedKey={selectedKey} signal={flyToSignal} />
        <ViewController view={view} />
      </MapContainer>

      <CrumbsControl
        view={view}
        onGo={(v) => {
          setView(v as keyof typeof VIEWS);
        }}
      />

      <div className="ov legend">
        <div className="label" style={{ marginBottom: 2 }}>
          Niveau de priorité
        </div>
        {(["hi", "md", "lo"] as const).map((l) => (
          <div className="r" key={l}>
            <i className="dot" style={{ background: `var(${LEVEL_VAR[l]})`, width: 11, height: 11 }} />
            {LVL[l].t.replace("Priorité ", "")}
            <span className="mono">{cnt[l] || 0}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Taille ∝ score (3×S/S + A/S)</div>
      </div>

      <div className="ov geonote">Positions des quartiers approximatives, à valider avec le district.</div>
    </div>
  );
}

function ViewController({ view }: { view: keyof typeof VIEWS }) {
  const map = useMap();
  const prev = useRef(view);
  useEffect(() => {
    if (view === prev.current) return;
    prev.current = view;
    map.flyToBounds(VIEWS[view] as unknown as LatLngBoundsExpression, { duration: 0.8 });
  }, [view, map]);
  return null;
}
