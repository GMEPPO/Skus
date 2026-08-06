/** Excel Status OK2 = already normalized; must not enter the pending queue. */
export function isOk2SourceStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.trim().replace(/\s+/g, "").toLowerCase() === "ok2";
}
