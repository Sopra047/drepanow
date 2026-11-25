"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agent.foumban@minsante.cm");
  const [password, setPassword] = useState("demo-drepanow");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Identifiants invalides.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div id="login">
      <div className="brand">
        <div className="label">Plateforme pilote · Ministère de la Santé Publique</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Drepanow AI" />
        <p>
          Cartographie des cas S/S et des porteurs A/S à l&apos;échelle des quartiers, avec un assistant IA pour orienter le dépistage et la
          sensibilisation. La consultation de la carte et des indicateurs est libre, sans connexion.
        </p>
      </div>
      <form onSubmit={submit}>
        <div>
          <h1>Connexion</h1>
          <div style={{ color: "var(--muted)" }}>
            Réservée au personnel de santé : import des registres et génération de rapports. La consultation reste accessible à tous sans compte.
          </div>
        </div>
        <label className="field">
          <span className="label">Identifiant</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          <span className="label">Mot de passe</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="bad">{error}</p>}
        <button className="btn primary" style={{ height: 40, justifyContent: "center" }} disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ height: 36, justifyContent: "center" }}
          onClick={() => router.push("/")}
        >
          Retour à la consultation
        </button>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Données de santé anonymisées · connexion chiffrée</div>
      </form>
    </div>
  );
}
