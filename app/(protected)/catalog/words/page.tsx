import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWords } from "@/lib/data";

export default async function CatalogWordsPage() {
  const words = await getWords();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Biblioteca</h1>
        <p className="mt-2 text-sm text-slate-400">
          Catalogo mestre de palavras, referencias curtas e designacoes reutilizaveis entre familias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Palavras configuraveis</CardTitle>
          <CardDescription>
            Cada item indica o tipo de campo principal, a referencia e a regra de designacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {words.map((word) => (
            <div
              key={word.id}
              className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-[1.2fr_auto_auto_1fr]"
            >
              <div>
                <p className="font-medium text-slate-100">{word.label}</p>
                <p className="text-sm text-slate-400">Designacao: {word.designation}</p>
              </div>
              <Badge variant="outline">{word.referenceCode}</Badge>
              <Badge>{word.fieldTypeLabel}</Badge>
              <div className="space-y-2 text-sm text-slate-400">
                <div>{word.includeInDesignation ? "Entra na designacao" : "So entra no codigo"}</div>
                <div>{word.familyLabels.length > 0 ? word.familyLabels.join(", ") : "Sem familias associadas"}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
