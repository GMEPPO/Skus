# Fase 2B.2 R5 — Validation Hold

**Estado:** `READY_NOT_APPLIED`  
**Fecha hold:** 2026-08-06  
**Proyecto GGMPI:** `pmovliksftlcjvjxvqhm` — **sin APPLY de R5**

## Hashes contractuales

| Artefacto | SHA-256 |
|-----------|---------|
| Migración `20260805150000_phase2b2_generate_and_complete_rpc.sql` | `8B59D1DD88A65299BCBCE5D86BE3589A82DCB73B08461DAFE5365775EFA4BF64` |
| Harness `phase2b2_r5_golden_rollback.sql` | `DCEEF71FB5C144F36684A929B3599FAB32C58B24C98915790AB276052AA59B58` |

Equivalencia harness = migración R5 **sin** `commit;` final + golden R5.1 + `rollback;`.

Cualquier cambio al SQL R5 exige nueva revisión (R6 / migración posterior) y nuevo hash.

## GGMPI no modificado por R5

Tras harness con `ROLLBACK` y post-check:

| check_id | present |
|----------|---------|
| schema_skus_private | false |
| fn_compute_selection_fingerprint | false |
| fn_generate_sku_secure | false |
| fn_complete_sku_normalization | false |
| col_request_id | false |
| idx_request_field | false |
| chk_fingerprint_hex | false |

## Gates aprobados

| Gate | Estado |
|------|--------|
| Revisión estática SQL R5 | CERRADO |
| Golden SQL ↔ TypeScript G1–G8 | CERRADO |
| Bloque 1 — rollback limpio | CERRADO |
| Bloque 2 — infra / propietarios | CERRADO |
| Bloque 3 — constraints / tipos físicos | CERRADO |

## Gates pendientes (bloquean APPLY)

| Gate | Estado |
|------|--------|
| Bloque 4 — Auth/JWT/RBAC + concurrencia real | **BLOQUEADO** (sin entorno aislado) |
| Bloque 5 — idempotencia historial / requestId | Pendiente |
| Bloque 6 — `complete_sku_normalization` | Pendiente |
| Bloque 7 — rollbacks transaccionales tardíos | Pendiente |
| Post-apply grants verification | Pendiente |

## Prohibición

- **NO** aplicar `20260805150000_phase2b2_generate_and_complete_rpc.sql` en GGMPI.
- **NO** crear las RPC temporalmente en GGMPI “solo para probar”.
- **NO** conectar UI productiva a las RPC.
- **NO** importar Excel / sembrar 142 palabras / activar normalización productiva por esta fase.

## Condición de reanudación (Bloque 4)

Uno de:

1. Proyecto Supabase temporal, o  
2. Database Branch / Supabase local completo (Auth + PostgREST + PostgreSQL)

PostgreSQL aislado sin Auth/PostgREST **no** cierra Bloque 4.

Primer reporte al reanudar (solo):

- `environment_ref` no sensible  
- confirmación de que **no** es GGMPI  
- SHA-256 de R5  
- resultado post-apply 4A  

## Artefactos preparados (no ejecutar contra GGMPI)

- `scripts/phase2b2_r5_auth_rpc_tests.cjs`
- `supabase/test/phase2b2_r5_block4a_post_apply_temp.sql`
- `supabase/test/phase2b2_r5_functional_fixture.sql`
- `supabase/test/phase2b2_r5_functional_cleanup.sql`
- `supabase/test/phase2b2_r5_post_apply_checks.sql`

Ledger: `supabase/test/MIGRATION_LEDGER_GGMPI.md` (entrada READY_NOT_APPLIED).
