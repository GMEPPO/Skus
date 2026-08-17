export function familyStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "active":
      return "Ativa";
    case "archived":
      return "Arquivada";
    default:
      return status;
  }
}

export function userRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "manager":
      return "Gestor";
    case "editor":
      return "Editor";
    case "viewer":
      return "Consulta";
    default:
      return role;
  }
}

export function measurementStatusLabel(status: "real" | "estimated"): string {
  return status === "real" ? "Confirmado" : "Estimado";
}
