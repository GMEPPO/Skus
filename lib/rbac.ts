import type { UserRole } from "@/lib/types";

const roleWeight: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  manager: 3,
  admin: 4,
};

export function hasMinimumRole(role: UserRole, required: UserRole) {
  return roleWeight[role] >= roleWeight[required];
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}

export function canManageVocabulary(role: UserRole) {
  return hasMinimumRole(role, "manager");
}

export function canManageFamilies(role: UserRole) {
  return hasMinimumRole(role, "manager");
}

export function canGenerateSku(role: UserRole) {
  return hasMinimumRole(role, "editor");
}
