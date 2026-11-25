import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import ImportFlow from "@/components/ImportFlow";
import ImportHeader from "@/components/ImportHeader";

export default async function ImportPage() {
  const role = await getRole();
  if (role === "lecteur") redirect("/login");

  return (
    <div id="app">
      <ImportHeader role={role} />
      <ImportFlow />
    </div>
  );
}
