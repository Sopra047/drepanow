"use client";

import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import type { UserRole } from "@/types/record";

export default function ImportHeader({ role }: { role: UserRole }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <Header
      role={role}
      view="import"
      srcLabel=""
      theme="light"
      onToggleTheme={() => {}}
      onOpenReport={() => {}}
      onOpenChat={() => {}}
      onLogout={logout}
    />
  );
}
