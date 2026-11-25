import { LVL, applyFilters, stats, zones } from "@/lib/zones";
import type { DataType, Filters, PatientRecord } from "@/types/record";

interface DatasetLike {
  src: string;
  recs: PatientRecord[];
}

const pos = (r: PatientRecord) => r.geno === "SS" || r.geno === "AS";

export interface AiContext {
  source: string;
  filtres: { localites: string[]; type: DataType; periode: string };
  totaux: {
    tests: number;
    cas_SS: number;
    porteurs_AS: number;
    micro_zones_prioritaires: number;
    pct_SS_symptomatiques: number;
    age_median_SS: number | null;
  };
  contextes_de_depistage_positifs: Record<string, number>;
  regle_priorite: string;
  quartiers: Array<{
    quartier: string;
    localite: string;
    SS: number;
    AS: number;
    tests: number;
    score: number;
    niveau: string;
    ages: (number | null)[];
    sexes: string;
    contextes: string[];
    antecedents_familiaux_oui: number;
  }>;
  zone_selectionnee: string | null;
}

type QuartierCtx = AiContext["quartiers"][number];

export function buildAiContext(ds: DatasetLike, f: Filters): AiContext {
  const recs = applyFilters(ds.recs, f);
  const zs = zones(recs, f.type);
  const st = stats(recs, f.type);
  const ctxCount: Record<string, number> = {};
  recs.forEach((r) => {
    if (pos(r)) ctxCount[r.contexte] = (ctxCount[r.contexte] || 0) + 1;
  });
  const sel = f.sel ? zs.find((z) => z.k === f.sel) : null;

  return {
    source: `${ds.src} — registre d'électrophorèse, hôpital ${[...new Set(recs.map((r) => r.hopital))].join(", ")} (Hôpital Régional Annexe de Foumban), région de l'Ouest, département du Noun`,
    filtres: { localites: f.locs ? [...f.locs] : [], type: f.type, periode: f.period },
    totaux: {
      tests: st.n,
      cas_SS: st.ss,
      porteurs_AS: st.as,
      micro_zones_prioritaires: st.hot,
      pct_SS_symptomatiques: st.sympSS,
      age_median_SS: st.medSS,
    },
    contextes_de_depistage_positifs: ctxCount,
    regle_priorite: "score = 3×S/S + A/S ; forte ≥ 6, moyenne 3–5, faible < 3",
    quartiers: zs.map((z) => ({
      quartier: z.name,
      localite: z.localite,
      SS: z.ss,
      AS: z.as,
      tests: z.n,
      score: z.ss * 3 + z.as,
      niveau: LVL[z.lvl].t,
      ages: z.recs.map((r) => r.age),
      sexes: z.recs.map((r) => r.sexe).join(""),
      contextes: [...new Set(z.recs.map((r) => r.contexte))],
      antecedents_familiaux_oui: z.recs.filter((r) => r.atcd).length,
    })),
    zone_selectionnee: sel ? `${sel.name} (${sel.localite})` : null,
  };
}

export const SUGGESTIONS = (localite = "Foumban") => [
  `Quels sont les 5 quartiers prioritaires à ${localite} ?`,
  "Explique pourquoi cette zone est un hotspot",
  `Génère un rapport d'action pour le district de ${localite}`,
  "Propose un plan de sensibilisation pour les porteurs A/S dans cette localité",
  "Quels scénarios d'allocation de kits de dépistage recommandes-tu ?",
];

export const REPORT_TYPES = [
  {
    id: "action",
    t: "Rapport d'action du district",
    d: "Synthèse, zones prioritaires, actions, responsables, échéances",
  },
  {
    id: "sensib",
    t: "Plan de sensibilisation des porteurs A/S",
    d: "Messages, canaux, partenaires communautaires, calendrier",
  },
  {
    id: "kits",
    t: "Scénarios d'allocation des kits de dépistage",
    d: "2–3 scénarios chiffrés selon le nombre de kits disponibles",
  },
] as const;

export type ReportTypeId = (typeof REPORT_TYPES)[number]["id"];

// ---------------------------------------------------------------------------
// Génération locale (aucun appel IA externe) : tout le texte ci-dessous est
// calculé à partir de `AiContext`, pas rédigé par un modèle de langage.
// ---------------------------------------------------------------------------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const OTHER_CM_CITIES = [
  "yaounde",
  "douala",
  "bafoussam",
  "bamenda",
  "garoua",
  "maroua",
  "ngaoundere",
  "bertoua",
  "ebolowa",
  "buea",
  "limbe",
  "kribi",
  "edea",
  "dschang",
  "mbouda",
  "bafang",
  "bangangte",
  "mfou",
  "nkongsamba",
];

function topContexts(ctx: AiContext, n = 3): string {
  const entries = Object.entries(ctx.contextes_de_depistage_positifs).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "aucun contexte renseigné dans les filtres actuels";
  return entries.slice(0, n).map(([c, count]) => `${c} (${count})`).join(", ");
}

function zoneLine(z: QuartierCtx): string {
  return `**${z.quartier}** (${z.localite}) — score ${z.score} (${z.niveau.toLowerCase()}), ${z.SS} S/S et ${z.AS} A/S sur ${z.tests} tests.`;
}

function resolveZone(ctx: AiContext): QuartierCtx | null {
  if (ctx.zone_selectionnee) {
    const z = ctx.quartiers.find((q) => `${q.quartier} (${q.localite})` === ctx.zone_selectionnee);
    if (z) return z;
  }
  return ctx.quartiers[0] ?? null;
}

/** Résout une zone sélectionnée explicitement, sans repli automatique sur le
 * quartier au score le plus élevé — utilisé pour les rapports déclenchés
 * depuis le chat (qui doivent par défaut cibler le district, pas « la zone
 * la plus probable »), à l'inverse de `resolveZone` (pronom « cette zone »). */
function selectedZoneOnly(ctx: AiContext): QuartierCtx | null {
  if (!ctx.zone_selectionnee) return null;
  return ctx.quartiers.find((q) => `${q.quartier} (${q.localite})` === ctx.zone_selectionnee) ?? null;
}

function defaultLocalite(ctx: AiContext): string {
  return ctx.filtres.localites[0] ?? "Foumban";
}

function describeZone(ctx: AiContext, z: QuartierCtx): string {
  const lines: string[] = [];
  lines.push(`## ${z.quartier} (${z.localite})`);
  lines.push(
    `Ce quartier a un score de priorité de **${z.score}** (${z.niveau.toLowerCase()}), calculé ainsi : ${ctx.regle_priorite}.`
  );
  lines.push(
    `- **${z.SS} cas S/S** et **${z.AS} porteurs A/S** sur ${z.tests} tests exploitables.`
  );
  if (z.antecedents_familiaux_oui > 0) {
    lines.push(`- ${z.antecedents_familiaux_oui} fiche(s) mentionnent des antécédents familiaux.`);
  }
  if (z.contextes.length) {
    lines.push(`- Contexte(s) de dépistage observé(s) : ${z.contextes.join(", ")}.`);
  }
  lines.push(
    "",
    "*Limite : échantillon issu d'un seul hôpital, biais de recrutement possible (hospitalisations, bilans prénuptiaux, dépistage des parents) ; position du quartier approximative.*"
  );
  return lines.join("\n");
}

function listTopZones(ctx: AiContext, n = 5): string {
  const top = ctx.quartiers.slice(0, n);
  if (!top.length) {
    return "Aucun quartier ne ressort avec les filtres actuels — essayez d'élargir la sélection de localités ou de période.";
  }
  const localite = defaultLocalite(ctx);
  const lines = [
    `## Quartiers prioritaires — ${localite}`,
    `Règle de priorité : ${ctx.regle_priorite}.`,
    "",
    ...top.map((z, i) => `${i + 1}. ${zoneLine(z)}`),
  ];
  return lines.join("\n");
}

function unknownCityAnswer(ctx: AiContext, city: string): string {
  const localites = ctx.filtres.localites.length ? ctx.filtres.localites.join(", ") : "Foumban";
  const top = ctx.quartiers[0];
  const analogy = top
    ? `\n\nPar analogie avec ${top.localite} : le quartier ${top.quartier} y concentre le score de priorité le plus élevé (${top.score}, ${top.niveau.toLowerCase()}) — une zone comparable à ${city} (quartier dense, proche d'un centre de santé, antécédents familiaux signalés) serait à surveiller en priorité une fois des données collectées.`
    : "";
  return `Le registre actuel ne couvre que ${localites} — aucune donnée n'est disponible pour **${city}**.\n\nPour intégrer ${city} à la cartographie, il faudrait importer un registre d'électrophorèse issu d'un établissement de santé de cette zone (menu Import, réservé au personnel de santé connecté).${analogy}`;
}

function extractKitsNumber(question: string): string | undefined {
  const m = question.match(/(\d{1,6})/);
  return m ? m[1] : undefined;
}

export function answerQuestion(ctx: AiContext, question: string): string {
  const q = norm(question);

  const unknownCity = OTHER_CM_CITIES.find(
    (c) => q.includes(c) && !ctx.filtres.localites.some((l) => norm(l).includes(c))
  );
  if (unknownCity && !ctx.quartiers.some((z) => norm(z.localite).includes(unknownCity))) {
    const label = unknownCity.charAt(0).toUpperCase() + unknownCity.slice(1);
    return unknownCityAnswer(ctx, label);
  }

  if (q.includes("sensibilis")) {
    const z = selectedZoneOnly(ctx);
    const scopeLabel = z ? `le quartier ${z.quartier} (${z.localite})` : `le district de santé de ${defaultLocalite(ctx)}`;
    return generateReport("sensib", ctx, scopeLabel, z);
  }

  if (q.includes("kit") || q.includes("allocation")) {
    const z = selectedZoneOnly(ctx);
    const scopeLabel = z ? `le quartier ${z.quartier} (${z.localite})` : `le district de santé de ${defaultLocalite(ctx)}`;
    return generateReport("kits", ctx, scopeLabel, z, extractKitsNumber(question));
  }

  if (q.includes("rapport")) {
    const z = selectedZoneOnly(ctx);
    const scopeLabel = z ? `le quartier ${z.quartier} (${z.localite})` : `le district de santé de ${defaultLocalite(ctx)}`;
    return generateReport("action", ctx, scopeLabel, z);
  }

  if ((q.includes("quartier") || q.includes("zone")) && (q.includes("prioritaire") || q.includes("top") || q.includes("5"))) {
    return listTopZones(ctx, 5);
  }

  if (q.includes("pourquoi")) {
    const z = resolveZone(ctx);
    return z
      ? describeZone(ctx, z)
      : "Aucune zone sélectionnée et aucune donnée exploitable avec les filtres actuels.";
  }

  const namedZone = ctx.quartiers.find((z) => z.quartier.length > 2 && q.includes(norm(z.quartier)));
  if (namedZone) return describeZone(ctx, namedZone);

  if (q.includes("combien") || q.includes("nombre") || q.includes("pourcentage") || q.includes("stat")) {
    return [
      `## Chiffres clés — ${defaultLocalite(ctx)}`,
      `- **${ctx.totaux.tests}** tests exploitables analysés.`,
      `- **${ctx.totaux.cas_SS}** cas S/S, **${ctx.totaux.porteurs_AS}** porteurs A/S.`,
      `- **${ctx.totaux.micro_zones_prioritaires}** micro-zone(s) en priorité forte sur ${ctx.quartiers.length} quartier(s) identifié(s).`,
      ctx.totaux.pct_SS_symptomatiques ? `- **${ctx.totaux.pct_SS_symptomatiques}%** des cas S/S sont symptomatiques.` : "",
      ctx.totaux.age_median_SS != null ? `- Âge médian des cas S/S : **${ctx.totaux.age_median_SS} ans**.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Repli : résumé général + pistes de questions.
  return [
    `## ${defaultLocalite(ctx)} — résumé`,
    `${ctx.totaux.tests} tests analysés avec les filtres actuels : **${ctx.totaux.cas_SS} cas S/S**, **${ctx.totaux.porteurs_AS} porteurs A/S**, ${ctx.totaux.micro_zones_prioritaires} micro-zone(s) prioritaire(s).`,
    "",
    ctx.quartiers.length ? "**Quartiers au score le plus élevé :**" : "",
    ...ctx.quartiers.slice(0, 3).map((z) => `- ${zoneLine(z)}`),
    "",
    "Essayez par exemple : « Quels sont les 5 quartiers prioritaires ? », « Pourquoi cette zone est un hotspot ? » ou « Génère un rapport d'action ».",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Rapports (générés localement, sans IA générative externe)
// ---------------------------------------------------------------------------

function allocateProportional(zs: QuartierCtx[], total: number): Array<{ z: QuartierCtx; qty: number }> {
  const scoreSum = zs.reduce((s, z) => s + z.score, 0) || 1;
  const raw = zs.map((z) => ({ z, qty: Math.round((z.score / scoreSum) * total) }));
  const diff = total - raw.reduce((s, r) => s + r.qty, 0);
  if (raw.length) raw[0].qty += diff;
  return raw;
}

function kitsScenarios(ctx: AiContext, zs: QuartierCtx[], kits?: string): string {
  if (!zs.length) return "Aucune zone exploitable avec les filtres actuels.";
  const n = kits ? parseInt(kits, 10) : undefined;
  const hi = zs.filter((z) => z.niveau.includes("forte"));
  const base = hi.length ? hi : zs;

  if (n && Number.isFinite(n) && n > 0) {
    const strict = allocateProportional(base, n);
    const prop = allocateProportional(zs, n);
    const equalQty = Math.floor(n / zs.length);
    const equalRem = n - equalQty * zs.length;
    return [
      `**Scénario 1 — Priorité stricte** (${n} kits réservés aux zones de priorité forte) :`,
      ...strict.map((r) => `- ${r.z.quartier} (${r.z.localite}) : ${r.qty} kits`),
      "",
      `**Scénario 2 — Proportionnel au score** (${n} kits répartis sur toutes les zones identifiées) :`,
      ...prop.map((r) => `- ${r.z.quartier} (${r.z.localite}) : ${r.qty} kits`),
      "",
      `**Scénario 3 — Couverture large** (${n} kits répartis également, pour maximiser le nombre de quartiers couverts) :`,
      ...zs.map((z, i) => `- ${z.quartier} (${z.localite}) : ${equalQty + (i < equalRem ? 1 : 0)} kits`),
    ].join("\n");
  }

  return [
    "**Scénario 1 — Priorité stricte** : 100% des kits aux zones de priorité forte, répartis proportionnellement à leur score.",
    "**Scénario 2 — Proportionnel au score** : répartition sur l'ensemble des quartiers identifiés, au prorata du score de chacun.",
    "**Scénario 3 — Couverture large** : répartition égale entre tous les quartiers, pour maximiser la couverture géographique plutôt que la concentration.",
    "",
    "*Indiquez un nombre de kits disponibles pour obtenir une répartition chiffrée par quartier.*",
  ].join("\n");
}

export function generateReport(
  typeId: ReportTypeId,
  ctx: AiContext,
  scopeLabel: string,
  scopeZone: QuartierCtx | null = null,
  kits?: string
): string {
  const type = REPORT_TYPES.find((r) => r.id === typeId)!;
  const top = ctx.quartiers.slice(0, 5);
  const zs = scopeZone ? [scopeZone] : top;

  const synthese = scopeZone
    ? `Le quartier **${scopeZone.quartier}** (${scopeZone.localite}) totalise ${scopeZone.tests} tests, dont **${scopeZone.SS} cas S/S** et **${scopeZone.AS} porteurs A/S** — score de priorité **${scopeZone.score}** (${scopeZone.niveau.toLowerCase()}), selon la règle : ${ctx.regle_priorite}.`
    : `Sur ${scopeLabel} (${ctx.totaux.tests} tests analysés), on recense **${ctx.totaux.cas_SS} cas S/S** et **${ctx.totaux.porteurs_AS} porteurs A/S**, répartis dans ${ctx.quartiers.length} quartier(s) dont **${ctx.totaux.micro_zones_prioritaires}** en priorité forte (règle : ${ctx.regle_priorite}).${ctx.totaux.pct_SS_symptomatiques ? ` ${ctx.totaux.pct_SS_symptomatiques}% des cas S/S recensés sont symptomatiques.` : ""}${ctx.totaux.age_median_SS != null ? ` Âge médian des cas S/S : ${ctx.totaux.age_median_SS} ans.` : ""}`;

  const zonesSection = [
    ...zs.map((z) => `- ${zoneLine(z)}`),
    "",
    `Contextes de dépistage positifs les plus fréquents : ${topContexts(ctx)}.`,
  ].join("\n");

  const limites = `Échantillon de ${ctx.totaux.tests} tests issu d'un seul hôpital (données ${ctx.source.split("—")[0].trim()}) — biais de recrutement possible (hospitalisations, bilans prénuptiaux, dépistage des parents). Les positions des quartiers sur la carte sont approximatives. Document généré automatiquement à partir du registre importé, sans IA générative — à valider par le responsable de district avant diffusion.`;

  const ressources = [
    "- Kits de dépistage de l'hémoglobine (quantité à ajuster selon le nombre de personnes ciblées).",
    "- Supports de sensibilisation en français (et langue locale si disponible).",
    "- Personnel de santé communautaire mobilisable dans les zones concernées.",
  ].join("\n");

  const indicateurs = [
    "- Nombre de nouveaux tests réalisés dans les zones ciblées.",
    "- Évolution du score de priorité par quartier après intervention.",
    "- Taux de participation aux séances de sensibilisation ou de dépistage.",
  ].join("\n");

  if (typeId === "sensib") {
    const as = scopeZone ? scopeZone.AS : ctx.totaux.porteurs_AS;
    const messages = [
      `- Expliquer la différence entre porteur A/S (sain, transmetteur potentiel) et malade S/S.`,
      `- Encourager le dépistage du conjoint avant tout projet de grossesse (${as} porteur(s) A/S identifié(s) sur le périmètre).`,
      `- Déconstruire les idées reçues sur la drépanocytose sans stigmatiser les familles concernées.`,
    ].join("\n");
    const canaux = [
      "- Relais communautaires et agents de santé des centres de proximité.",
      "- Associations de patients et groupements de femmes/jeunes déjà actifs dans la zone.",
      "- Annonces lors des consultations prénatales et des campagnes de vaccination.",
    ].join("\n");
    return [
      `# ${type.t} — ${scopeLabel}`,
      "## Synthèse",
      synthese,
      "## Zones prioritaires et justification",
      zonesSection,
      "## Publics cibles et messages clés",
      messages,
      "## Canaux et relais communautaires",
      canaux,
      "## Ressources nécessaires",
      ressources,
      "## Indicateurs de suivi",
      indicateurs,
      "## Limites des données",
      limites,
    ].join("\n\n");
  }

  if (typeId === "kits") {
    return [
      `# ${type.t} — ${scopeLabel}`,
      "## Synthèse",
      synthese,
      "## Zones prioritaires et justification",
      zonesSection,
      "## Scénarios d'allocation",
      kitsScenarios(ctx, zs, kits),
      "## Ressources nécessaires",
      ressources,
      "## Indicateurs de suivi",
      indicateurs,
      "## Limites des données",
      limites,
    ].join("\n\n");
  }

  const actions = [
    `- Déployer une campagne de dépistage ciblée dans ${zs.map((z) => z.quartier).join(", ")} — responsable : équipe du district sanitaire — échéance : 30 jours.`,
    `- Informer les familles des porteurs A/S identifiés (${scopeZone ? scopeZone.AS : ctx.totaux.porteurs_AS} au total sur le périmètre) sur le conseil génétique — responsable : agents de santé communautaire — échéance : 45 jours.`,
    "- Mettre à jour le registre après chaque nouvelle campagne pour suivre l'évolution des scores de priorité — responsable : point focal données — échéance : continu.",
  ].join("\n");

  return [
    `# ${type.t} — ${scopeLabel}`,
    "## Synthèse",
    synthese,
    "## Zones prioritaires et justification",
    zonesSection,
    "## Actions recommandées",
    actions,
    "## Ressources nécessaires",
    ressources,
    "## Indicateurs de suivi",
    indicateurs,
    "## Limites des données",
    limites,
  ].join("\n\n");
}
