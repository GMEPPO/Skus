import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { canManageUsers } from "@/lib/rbac";
import { demoCurrentUser } from "@/lib/data";
import type { AppUser, UserRole } from "@/lib/types";

function isDemoMode() {
  return process.env.SKIP_AUTH === "true";
}

async function ensureProfile(userId: string, email: string | null) {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const existing = await supabase
    .from("skus_profiles")
    .select("id, name, email, department, is_active, skus_roles(code)")
    .eq("id", userId)
    .maybeSingle();

  if (existing.data) return existing.data;

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

  return inserted.data ?? null;
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

  const roleCode = Array.isArray(profileResult.data.skus_roles)
    ? profileResult.data.skus_roles[0]?.code
    : profileResult.data.skus_roles?.code;

  return {
    id: profileResult.data.id,
    name: profileResult.data.name,
    email: profileResult.data.email,
    department: profileResult.data.department ?? "General",
    isActive: profileResult.data.is_active ?? true,
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
