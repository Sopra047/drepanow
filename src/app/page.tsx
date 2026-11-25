import Dashboard from "@/components/Dashboard";
import { getRole } from "@/lib/auth";

/** Page d'accueil = tableau de bord public. Aucune connexion requise pour
 * consulter la carte et les indicateurs (rôle "lecteur" par défaut). */
export default async function Home() {
  const role = await getRole();
  return <Dashboard initialRole={role} />;
}
