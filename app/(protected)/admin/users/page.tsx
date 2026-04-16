import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUsers } from "@/lib/data";

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Administração de utilizadores</h1>
        <p className="mt-2 text-sm text-slate-400">
          Estrutura equivalente à app atual, com papéis, permissões e estado de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
          <CardDescription>
            Este ecrã já está preparado para ser ligado ao `profiles`, `roles` e `permissions` no Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]"
            >
              <div>
                <p className="font-medium text-slate-100">{user.name}</p>
                <p className="text-sm text-slate-400">{user.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Departamento</p>
                <p className="text-sm text-slate-300">{user.department}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Papel</p>
                <Badge>{user.role}</Badge>
              </div>
              <div className="flex items-start justify-end">
                <Badge variant={user.isActive ? "success" : "outline"}>
                  {user.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
