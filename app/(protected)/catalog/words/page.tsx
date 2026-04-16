import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWords } from "@/lib/data";

export default async function CatalogWordsPage() {
  const words = await getWords();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Vocabulário</h1>
        <p className="mt-2 text-sm text-slate-400">
          Catálogo mestre de palavras e referências curtas de 3 caracteres, reutilizável entre famílias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Palavras configuráveis</CardTitle>
          <CardDescription>
            Cada item indica o tipo de campo principal e a referência usada na composição do SKU.
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
                <p className="text-sm text-slate-400">{word.description}</p>
              </div>
              <Badge variant="outline">{word.referenceCode}</Badge>
              <Badge>{word.fieldTypeLabel}</Badge>
              <div className="text-sm text-slate-400">{word.contextLabel}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
