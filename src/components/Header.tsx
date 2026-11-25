"use client";

import Link from "next/link";
import type { UserRole } from "@/types/record";

interface Props {
  role: UserRole;
  view: "dash" | "import";
  srcLabel: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenReport: () => void;
  onOpenChat: () => void;
  onLogout: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  lecteur: "Visiteur",
  sante: "Utilisateur santé",
  admin: "Administrateur",
};

export default function Header({ role, view, srcLabel, theme, onToggleTheme, onOpenReport, onOpenChat, onLogout }: Props) {
  const authed = role === "admin" || role === "sante";

  return (
    <header className="top">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" />
        <span>
          Drepanow <em>AI</em>
        </span>
      </div>
      <nav className="navw">
        <Link href="/" className={view === "dash" ? "on" : ""}>
          Tableau de bord
        </Link>
        {authed && (
          <Link href="/import" className={view === "import" ? "on" : ""}>
            Import<span className="hide-m">&nbsp;de données</span>
          </Link>
        )}
      </nav>
      <div className="sp" />
      {view === "dash" && (
        <div className="srcchip">
          <i className="dot" style={{ background: "oklch(0.65 0.15 150)" }} />
          <span>{srcLabel}</span>
        </div>
      )}
      {authed && view === "dash" && (
        <button className="btn sm" onClick={onOpenReport}>
          Générer un rapport
        </button>
      )}
      {view === "dash" && (
        <button className="btn sm chatbtn" onClick={onOpenChat}>
          Assistant IA
        </button>
      )}
      <button className="iconbtn" title="Thème clair / sombre" onClick={onToggleTheme}>
        <span className="mono" style={{ fontSize: 13 }}>
          {theme === "dark" ? "◑" : "◐"}
        </span>
      </button>
      <span className="rolechip">{ROLE_LABEL[role]}</span>
      {authed ? (
        <button className="btn ghost sm" onClick={onLogout}>
          Quitter
        </button>
      ) : (
        <Link className="btn sm" href="/login">
          Se connecter
        </Link>
      )}
    </header>
  );
}
