"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

const createUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2),
  department: z.string().trim().min(1),
  roleCode: z.enum(["admin", "manager", "editor", "viewer"]),
  provisionalPassword: z.string().min(8),
});

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  roleCode: z.enum(["admin", "manager", "editor", "viewer"]),
  department: z.string().trim().min(1),
  isActive: z.boolean(),
});

export async function createAdminUserAction(formData: FormData) {
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    department: formData.get("department"),
    roleCode: formData.get("roleCode"),
    provisionalPassword: formData.get("provisionalPassword"),
  });

  if (!parsed.success) {
    redirect("/admin/users?status=error&message=Dados+invalidos+no+novo+utilizador");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/admin/users?status=error&message=Supabase+service+role+nao+configurada");
  }

  const roleResult = await supabase.from("skus_roles").select("id").eq("code", parsed.data.roleCode).maybeSingle();
  if (!roleResult.data?.id) {
    redirect("/admin/users?status=error&message=Papel+invalido");
  }

  const created = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.provisionalPassword,
    email_confirm: true,
    user_metadata: {
      name: parsed.data.name,
    },
  });

  if (created.error || !created.data.user) {
    redirect("/admin/users?status=error&message=Nao+foi+possivel+criar+o+utilizador+diretamente");
  }

  const profileUpsert = await supabase.from("skus_profiles").upsert({
    id: created.data.user.id,
    email: parsed.data.email,
    name: parsed.data.name,
    department: parsed.data.department,
    role_id: roleResult.data.id,
    is_active: true,
  });

  if (profileUpsert.error) {
    redirect("/admin/users?status=error&message=Utilizador+criado+mas+o+perfil+nao+foi+guardado");
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  redirect("/admin/users?status=success&message=Utilizador+criado+com+senha+provisoria");
}

export async function updateAdminUserAction(formData: FormData) {
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    roleCode: formData.get("roleCode"),
    department: formData.get("department"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    redirect("/admin/users?status=error&message=Dados+invalidos+na+atualizacao");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/admin/users?status=error&message=Supabase+service+role+nao+configurada");
  }

  const roleResult = await supabase.from("skus_roles").select("id").eq("code", parsed.data.roleCode).maybeSingle();
  if (!roleResult.data?.id) {
    redirect("/admin/users?status=error&message=Papel+invalido");
  }

  const updateResult = await supabase
    .from("skus_profiles")
    .update({
      role_id: roleResult.data.id,
      department: parsed.data.department,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.userId);

  if (updateResult.error) {
    redirect("/admin/users?status=error&message=Nao+foi+possivel+atualizar+o+utilizador");
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  redirect("/admin/users?status=success&message=Utilizador+atualizado+com+sucesso");
}
