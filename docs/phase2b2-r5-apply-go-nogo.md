# Fase 2B.2 R5 — Go / No-Go APPLY controlado (GGMPI)

**OK supervisor:** APPLY controlado autorizado **solo** con checklist en verde.  
**Migración:** `supabase/migrations/20260805150000_phase2b2_generate_and_complete_rpc.sql`  
**SHA-256 esperado:** `8B59D1DD88A65299BCBCE5D86BE3589A82DCB73B08461DAFE5365775EFA4BF64`  
**Flag:** `NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2=false` (obligatorio durante APPLY y Bloques 4–7)

## Checklist (marcar antes de pegar SQL)

| # | Check | Estado |
|---|--------|--------|
| 1 | PITR/backups visibles en Dashboard Supabase GGMPI (fecha, retención, quién puede restaurar) **o** dump lógico legible de `skus_*` | ⬜ Miguel |
| 2 | Flag V2 = `false` en el entorno desplegado; UI usa `generateSkuAction` legacy | ✅ código por defecto OFF |
| 3 | Hash local = `8B59D1DD…EFA4BF64` | ✅ verificado 2026-08-06 |
| 4 | Rollback listo: `supabase/test/phase2b2_r5_rollback.sql` | ✅ |
| 5 | Scripts 4A/fixture/cleanup/post-apply + auth runner versionados | ✅ |
| 6 | Ventana operativa registrada (hora, operador, sin uso SKU / imports) | ⬜ Miguel |

## Secuencia

1. Snapshot pre-apply (Bloques 1–3 + counts).  
2. Pegar **solo** el archivo de migración (hash validado) en SQL Editor GGMPI.  
3. `phase2b2_r5_post_apply_checks.sql` → todo `passed=true`.  
4. Bloques 4–7 (Auth, complete, rollbacks).  
5. Cleanup fixtures.  
6. Flag sigue OFF. Activar UI V2 = **autorización posterior**.

## Rollback obligatorio si

- `anon` puede EXECUTE RPC  
- `authenticated` usa `skus_private`  
- doble generación / historial no atómico / colisión incorrecta / cleanup ambiguo  

Script: `supabase/test/phase2b2_r5_rollback.sql`  
(Columna `request_id`: dropear solo tras limpiar fixtures; línea comentada en el script.)

## No autorizado aún

- Flag V2 = true  
- Import Excel / 142 palabras / normalización masiva  
- SQL ad hoc que modifique R5  
