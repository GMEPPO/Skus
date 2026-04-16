import type { ReactNode } from "react";
import { AppShellMain } from "@/components/app-shell-main";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAuth();

  return <AppShellMain user={user}>{children}</AppShellMain>;
}
