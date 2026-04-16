import Link from "next/link";
import { ArrowRight, GitBranchPlus, MoveRight, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createFamilyAction, deleteFamilyAction, getFamiliesCatalog, getWordsCatalog } from "@/lib/admin-catalog";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function FamiliesManagePage({
  searchParams,
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const [families, words] = await Promise.all([
    getFamiliesCatalog(),
    getWordsCatalog(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Familias e arvores</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Cria familias novas e prepara a base para o builder visual persistente.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nova familia</CardTitle>
          <CardDescription>
            Nesta fase podes criar a familia base. A configuracao da arvore completa vem no passo seguinte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFamilyAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Nome</span>
              <input
                name="name"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Ex: Valera"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Slug</span>
              <input
                name="slug"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="valera"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Estado</span>
              <select
                name="status"
                defaultValue="draft"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Descricao</span>
              <input
                name="description"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Descricao opcional"
              />
            </label>
            <div className="md:col-span-2 xl:col-span-4">
              <Button type="submit">Guardar familia</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Familias criadas</CardTitle>
            <CardDescription>
              Cada familia pode depois receber niveis, palavras e relacoes no builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {families.map((family) => (
              <div key={family.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{family.name}</p>
                    <p className="text-sm text-slate-400">{family.description || "Sem descricao"}</p>
                  </div>
                  <Badge variant={family.status === "active" ? "success" : "outline"}>
                    {family.status}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {family.levelLabels.length > 0 ? (
                    family.levelLabels.map((level) => (
                      <div
                        key={level}
                        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1"
                      >
                        <span>{level}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">Sem niveis publicados ainda</span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" className="h-10">
                    <Link href={`/families-manage/${family.id}`} className="inline-flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Configurar builder
                    </Link>
                  </Button>
                  <form action={deleteFamilyAction}>
                    <input type="hidden" name="familyId" value={family.id} />
                    <Button type="submit" variant="outline" className="h-10 text-red-100 hover:bg-red-500/10">
                      Eliminar familia
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview do builder</CardTitle>
            <CardDescription>
              A biblioteca ja reflete a biblioteca real. O drag and drop persistente sera o proximo passo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <GitBranchPlus className="h-4 w-4" />
                <span className="text-sm font-medium">Biblioteca de palavras</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {words.slice(0, 12).map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "Nivel 1", label: "Familia", items: families.slice(0, 2).map((item) => item.name) },
                { title: "Nivel 2", label: "Formato", items: words.filter((item) => item.fieldTypeLabel.toLowerCase().includes("form")).slice(0, 2).map((item) => item.label) },
                { title: "Nivel 3", label: "Produto", items: words.filter((item) => item.fieldTypeLabel.toLowerCase().includes("prod")).slice(0, 2).map((item) => item.label) },
              ].map((column) => (
                <div key={column.title} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{column.title}</p>
                    <p className="font-medium text-slate-100">{column.label}</p>
                  </div>
                  <div className="space-y-2">
                    {column.items.length > 0 ? (
                      column.items.map((item) => (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-300"
                        >
                          <span>{item}</span>
                          <MoveRight className="h-4 w-4 text-slate-500" />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-500">
                        Sem dados suficientes ainda
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
