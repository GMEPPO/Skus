# Ledger manual de migraciones SKUS (proyecto GGMPI)
# Motivo: no existe supabase_migrations.schema_migrations porque
# las migraciones se aplicaron vía SQL Editor, no vía Supabase CLI.

| Orden | Archivo | Aplicado vía | Estado |
|------:|---------|--------------|--------|
| 1 | `20260805100000_phase1a_categories_levels_normalizations.sql` | SQL Editor | Aplicado (upgrade verificado) |
| 2 | hotfix grants (contenido de `hotfix_skus_grants_and_privilege_checks.sql`) | SQL Editor | Aplicado |
| 3 | `20260805120000_phase1a_privilege_hardening.sql` | SQL Editor | Aplicado (privilegios confirmados) |
| 4 | `20260805140000_phase2b1_fingerprint_and_nullable_field_type.sql` | SQL Editor | Aplicado 2026-08-05 |

SHA-256 `20260805140000…`:
`ca77455c0920faf61898f70b51e1938ea18b956d5d0c0c12a94c804208dda10d`

Verificación post-aplicación:
- `selection_fingerprint` presente; históricos v1 = NULL
- generations=3, words=61 preservados
- Medidas en `skus_sku_generations` ya nullable (OK para complete sin medidas)

Privilegios confirmados (`authenticated` sobre las 4 tablas):
`select=true`, `insert=false`, `update=false`, `delete=false`

Historial CLI: `supabase_migrations.schema_migrations` no existe en GGMPI
(migraciones aplicadas por SQL Editor). Ledger manual = fuente de verdad.

Regla ledger (supervisor): cada ejecución SQL Editor debe registrar versión, SHA-256 del SQL, fecha, proyecto, ejecutor, resultado.
