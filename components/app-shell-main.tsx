import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Boxes, Shield, Tags, Workflow } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { AppUser } from "@/lib/types";
import { canManageUsers } from "@/lib/rbac";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/generator", label: "Gerador SKU", icon: Workflow },
  { href: "/families", label: "Familias", icon: Boxes },
  { href: "/catalog/words", label: "Vocabulario", icon: Tags },
  { href: "/sku-history", label: "Historico", icon: BarChart3 },
  { href: "/admin/users", label: "Admin", icon: Shield, adminOnly: true },
];

export function AppShellMain({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return canManageUsers(user.role);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="container mx-auto flex min-h-16 flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-amber-300">Skus Administrator</p>
            <p className="text-sm text-slate-400">Administracao de utilizadores, vocabulario e arvores SKU</p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">
              {user.name} - <span className="uppercase text-amber-300">{user.role}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
