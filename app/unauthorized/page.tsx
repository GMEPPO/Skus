import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-50">Acesso não autorizado</h1>
        <p className="mt-3 text-sm text-slate-400">
          O teu perfil não tem permissões suficientes para aceder a esta área.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
