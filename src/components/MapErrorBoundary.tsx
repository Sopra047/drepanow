"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

/**
 * Leaflet initialise la carte de façon impérative sur un nœud DOM. En développement,
 * le rechargement à chaud (Fast Refresh) peut remonter le composant pendant que
 * Leaflet est encore en train de s'initialiser, ce qui le fait planter
 * ("Cannot read properties of undefined (reading 'appendChild')" / "Map container
 * is being reused"). Sans filet, cette erreur de rendu faisait planter tout le
 * tableau de bord. Cette limite isole le crash à la carte : le reste de
 * l'application (filtres, graphiques, assistant IA) continue de fonctionner.
 */
export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Carte : erreur d'initialisation Leaflet, affichage du repli.", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="mapwrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "var(--muted)" }}>
            <p>La carte n&apos;a pas pu s&apos;initialiser.</p>
            <button className="btn sm primary" onClick={() => location.reload()}>
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
