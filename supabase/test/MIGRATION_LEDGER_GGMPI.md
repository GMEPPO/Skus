# Ledger manual de migraciones SKUS (proyecto GGMPI)
# Motivo: no existe supabase_migrations.schema_migrations porque
# las migraciones se aplicaron vía SQL Editor, no vía Supabase CLI.

| Orden | Archivo | Aplicado vía | Estado |
|------:|---------|--------------|--------|
| 1 | `20260805100000_phase1a_categories_levels_normalizations.sql` | SQL Editor | Aplicado (upgrade verificado) |
| 2 | hotfix grants (contenido de `hotfix_skus_grants_and_privilege_checks.sql`) | SQL Editor | Aplicado |
| 3 | `20260805120000_phase1a_privilege_hardening.sql` | SQL Editor | Aplicado (privilegios confirmados) |
| 4 | `20260805140000_phase2b1_fingerprint_and_nullable_field_type.sql` | SQL Editor | Aplicado 2026-08-05 |
| 5 | `20260805150000_phase2b2_generate_and_complete_rpc.sql` | SQL Editor | **PHASE2B2_BACKEND_VALIDATED** (2026-08-06) — R5 APPLIED; GENERATOR_UI_V2 REMEDIATION_REQUIRED; NORMALIZATION_UI_V2 PENDING |

SHA-256 `20260805140000…`:
`ca77455c0920faf61898f70b51e1938ea18b956d5d0c0c12a94c804208dda10d`

---

## Entrada 5 — Fase 2B.2 R5 (RPC generate/complete)

| Campo | Valor |
|-------|-------|
| Migration | `20260805150000_phase2b2_generate_and_complete_rpc.sql` |
| SHA-256 | `8B59D1DD88A65299BCBCE5D86BE3589A82DCB73B08461DAFE5365775EFA4BF64` |
| Harness SHA-256 | `DCEEF71FB5C144F36684A929B3599FAB32C58B24C98915790AB276052AA59B58` |
| Target | GGMPI / `pmovliksftlcjvjxvqhm` |
| Applied | **YES** (2026-08-06, SQL Editor, APPLY controlado) |
| Status | **PHASE2B2_BACKEND_VALIDATED** / `R5=APPLIED` / `UI_V2_ACTIVATION=NOT_AUTHORIZED` |
| Feature flag | `NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2=false` (obligatorio) |
| Authorization | APPLY controlado OK supervisor; UI V2 **no** autorizada aún |

**Block status (supervisor 2026-08-06):**
- `BLOCK4: CLOSED` — Pass1 `b1ebee11-af3d-474e-91cf-941aeeaff80d`; Pass2 `7e3daf96-c8af-4585-b88a-a9c269674c50`
- `BLOCK5: CLOSED`
- `BLOCK6: CLOSED`
- `BLOCK7: CLOSED` — evidencia 7A/7B consolidada; instrumentación temporal removida; security gate final 13/13 confirmado
- `UI_V2: NOT_AUTHORIZED`
- `GENERATOR_UI_V2: REMEDIATION_REQUIRED`
- `NORMALIZATION_UI_V2: PENDING`

**Completed:**
- Static SQL review R5
- Golden SQL/TS G1–G8
- Rollback cleanliness (pre-apply harness)
- Infrastructure/owner preflight
- Constraints and physical types
- APPLY controlado en GGMPI
- Post-apply structural 8/8
- Security gate 4A.1 initial 13/13
- Auth Pass1 + Pass2
- Bloques 5–6 functional (PowerShell)
- Bloque 7 functional + rollback evidence cerrado
- Security gate final 13/13 tras cleanup

**Pending:**
- Repo hygiene con repositorio Git real (`git status --short` / `git diff --check` / `git log -1 --oneline`)
- Activación controlada de `GENERATOR_UI_V2` con `NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2=false` hasta nuevo OK
- Gate separado para `NORMALIZATION_UI_V2`

**UI status (supervisor 2026-08-06):**
- `PHASE2B2_BACKEND_VALIDATED`
- `GENERATOR_UI_V2=REMEDIATION_REQUIRED`
- `NORMALIZATION_UI_V2=PENDING`
- `UI_V2_ACTIVATION=NOT_AUTHORIZED`

Hold / go-nogo: `docs/phase2b2-r5-validation-hold.md`, `docs/phase2b2-r5-apply-go-nogo.md`

Verificación post-aplicación:
- `selection_fingerprint` presente; históricos v1 = NULL
- generations=3, words=61 preservados
- Medidas en `skus_sku_generations` ya nullable (OK para complete sin medidas)

Privilegios confirmados (`authenticated` sobre las 4 tablas):
`select=true`, `insert=false`, `update=false`, `delete=false`

Historial CLI: `supabase_migrations.schema_migrations` no existe en GGMPI
(migraciones aplicadas por SQL Editor). Ledger manual = fuente de verdad.

Regla ledger (supervisor): cada ejecución SQL Editor debe registrar versión, SHA-256 del SQL, fecha, proyecto, ejecutor, resultado.
