import { ArrowRight, GitBranchPlus, MoveRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFamilies } from "@/lib/data";

export default async function FamiliesPage() {
  const families = await getFamilies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Famílias e árvores</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Gestão da sequência de campos, palavras disponíveis por nível e ligações válidas entre passos.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Famílias ativas</CardTitle>
            <CardDescription>
              Cada família aponta para uma árvore publicada e uma regra de composição completa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {families.map((family) => (
              <div key={family.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{family.name}</p>
                    <p className="text-sm text-slate-400">{family.description}</p>
                  </div>
                  <Badge variant={family.status === "active" ? "success" : "outline"}>
                    {family.status}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {family.levelLabels.map((level) => (
                    <div
                      key={level}
                      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1"
                    >
                      <span>{level}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Builder visual</CardTitle>
            <CardDescription>
              Proposta de interface drag and drop para distribuir palavras pelos níveis e validar dependências.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <GitBranchPlus className="h-4 w-4" />
                <span className="text-sm font-medium">Biblioteca de palavras</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Guerla", "Frasco", "Bisnaga", "Shampoo", "300ml", "Caixa"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "Nível 1", label: "Família", items: ["Guerla", "Savoy"] },
                { title: "Nível 2", label: "Formato", items: ["Frasco", "Bisnaga"] },
                { title: "Nível 3", label: "Produto", items: ["Shampoo", "Gel"] },
              ].map((column) => (
                <div key={column.title} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{column.title}</p>
                    <p className="font-medium text-slate-100">{column.label}</p>
                  </div>
                  <div className="space-y-2">
                    {column.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-300"
                      >
                        <span>{item}</span>
                        <MoveRight className="h-4 w-4 text-slate-500" />
                      </div>
                    ))}
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
