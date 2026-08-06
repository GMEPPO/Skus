-- ============================================================================
-- FASE 2B.2 R5 — FUNCTIONAL FIXTURE (ENTORNO TEMPORAL ONLY)
-- Prefijo / test_run_id: pasar como comentario o sustituir :test_run_id
-- NO EJECUTAR EN GGMPI (pmovliksftlcjvjxvqhm)
-- ============================================================================
-- Purpose: mark fixture rows for later cleanup. Prefer creating Auth users
-- and SKU payloads via scripts/phase2b2_r5_auth_rpc_tests.cjs.
-- This file is a placeholder for any SQL-only seed needed by Bloques 4I+
-- (legacy / collision rows). Keep all fixture keys prefixed with:
--   p2b2r5_<test_run_id>_
-- ============================================================================

-- Example marker batch (safe no-op if you only use the Node runner):
-- insert into public.skus_normalization_import_batches (...)
-- values (... 'p2b2r5_<test_run_id>_marker.xlsx' ...);

select 'phase2b2_r5_functional_fixture: prepared — replace with run-specific seeds' as status;
