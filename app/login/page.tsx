import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const isDemo = process.env.SKIP_AUTH === "true";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900/90">
        <CardHeader>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-300">
            Skus Administrator
          </p>
          <CardTitle className="text-3xl">Acesso à plataforma</CardTitle>
          <CardDescription>
            Esta base já está pronta para autenticação Supabase SSR. Enquanto o backend não estiver ligado,
            podes entrar em modo demo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
            <p>
              Modo demo: <span className="font-medium text-amber-300">{isDemo ? "ativo" : "inativo"}</span>
            </p>
            <p className="mt-2">
              Para autenticação real, configura `NEXT_PUBLIC_SUPABASE_URL`,
              `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="sm:flex-1">
              <Link href="/dashboard">Entrar na aplicação</Link>
            </Button>
            <Button asChild variant="outline" className="sm:flex-1">
              <Link href="/generator">Ver gerador SKU</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
