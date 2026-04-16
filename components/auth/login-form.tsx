"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

export function LoginForm({
  isDemo,
}: {
  isDemo: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isDemo) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("As variáveis públicas do Supabase não estão disponíveis no cliente.");
      return;
    }

    setIsPending(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isDemo ? (
        <>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              placeholder="tu@email.com"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              placeholder="••••••••"
            />
          </label>
        </>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isDemo ? "Entrar em modo demo" : "Entrar na aplicação"}
      </Button>
    </form>
  );
}
