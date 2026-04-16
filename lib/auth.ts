import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { canManageUsers } from "@/lib/rbac";
import { demoCurrentUser } from "@/lib/data";
import type { AppUser, UserRole } from "@/lib/types";

type SupabaseRoleRelation = { code: string } | Array<{ code: string }> | null;

type SupabaseProfileRow = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  is_active: boolean | null;
  skus_roles?: SupabaseRoleRelation;
};

function isDemoMode() {
  return process.env.SKIP_AUTH === "true";
}

function extractRoleCode(relation: SupabaseRoleRelation | undefined): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) {
    return relation[0]?.code ?? null;
  }
  return relation.code ?? null;
}

async function ensureProfile(userId: string, email: string | null) {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const existing = await supabase
    .from("skus_profiles")
    .select("id, name, email, department, is_active, skus_roles(code)")
    .eq("id", userId)
    .maybeSingle();

  if (existing.data) return existing.data as SupabaseProfileRow;

  const name = email ? email.split("@")[0] : "utilizador";
  const viewerRole = await supabase.from("skus_roles").select("id").eq("code", "viewer").maybeSingle();
  if (!viewerRole.data?.id) return null;

  const inserted = await supabase
    .from("skus_profiles")
    .insert({
      id: userId,
      name,
      email: email ?? `${userId}@local`,
      department: "General",
      role_id: viewerRole.data.id,
      is_active: true,
    })
    .select("id, name, email, department, is_active, skus_roles(code)")
    .single();

  return (inserted.data as SupabaseProfileRow | null) ?? null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isDemoMode()) {
    return demoCurrentUser;
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const authResult = await supabase.auth.getUser();
  if (authResult.error || !authResult.data.user) return null;

  const authUser = authResult.data.user;
  let profileResult = await supabase
    .from("skus_profiles")
    .select("id, name, email, department, is_active, skus_roles(code)")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profileResult.data) {
    await ensureProfile(authUser.id, authUser.email ?? null);
    profileResult = await supabase
      .from("skus_profiles")
      .select("id, name, email, department, is_active, skus_roles(code)")
      .eq("id", authUser.id)
      .maybeSingle();
  }

  if (!profileResult.data) {
    return null;
  }

  const profile = profileResult.data as SupabaseProfileRow;
  const roleCode = extractRoleCode(profile.skus_roles);

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    department: profile.department ?? "General",
    isActive: profile.is_active ?? true,
    role: (roleCode ?? "viewer") as UserRole,
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(required: UserRole) {
  const user = await requireAuth();
  const roleOrder: Record<UserRole, number> = {
    viewer: 1,
    editor: 2,
    manager: 3,
    admin: 4,
  };

  if (roleOrder[user.role] < roleOrder[required]) {
    redirect("/unauthorized");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!canManageUsers(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}
