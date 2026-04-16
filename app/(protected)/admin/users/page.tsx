import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminUserAction, updateAdminUserAction } from "@/lib/admin-users";
import { requireAdmin } from "@/lib/auth";
import { getUsers } from "@/lib/data";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { status?: string; message?: string };
}) {
  await requireAdmin();
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Administração de utilizadores</h1>
        <p className="mt-2 text-sm text-slate-400">
          Criacao, ativacao, desativacao e gestao de papeis dos utilizadores reais.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Novo utilizador</CardTitle>
          <CardDescription>Cria utilizador diretamente com senha provisoria e perfil administrativo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAdminUserAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Nome</span>
              <input
                name="name"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                name="email"
                type="email"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Departamento</span>
              <input
                name="department"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Papel</span>
              <select
                name="roleCode"
                defaultValue="viewer"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-slate-300">Senha provisoria</span>
              <input
                name="provisionalPassword"
                type="password"
                minLength={8}
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>
            <div className="md:col-span-2 xl:col-span-4">
              <Button type="submit">Criar utilizador</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
          <CardDescription>
            Lista real ligada a `profiles` e `roles` no Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <form
              key={user.id}
              action={updateAdminUserAction}
              className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto]"
            >
              <input type="hidden" name="userId" value={user.id} />
              <div>
                <p className="font-medium text-slate-100">{user.name}</p>
                <p className="text-sm text-slate-400">{user.email}</p>
              </div>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Departamento</span>
                <input
                  name="department"
                  defaultValue={user.department}
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Papel</span>
                <select
                  name="roleCode"
                  defaultValue={user.role}
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={user.isActive}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
                />
                Ativo
              </label>
              <div className="flex items-end justify-end">
                <Button type="submit" variant="outline">Guardar</Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
