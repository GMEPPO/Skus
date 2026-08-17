/** Excel Status OK2 = legacy marker only; import always enters the pending queue. */
export function isOk2SourceStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.trim().replace(/\s+/g, "").toLowerCase() === "ok2";
}
