const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
(async () => {
  const env = loadEnv(".env.test-supabase");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = {};

  for (const t of ["skus_categories","skus_category_levels","skus_normalization_import_batches","skus_code_normalizations"]) {
    const { data, error, count } = await sb.from(t).select("*", { count: "exact" }).limit(5);
    checks[t] = error ? { error: error.message, code: error.code } : { count, rows: data };
  }

  // column probes
  const colProbes = [
    ["skus_words", "category_level_id"],
    ["skus_sku_generations", "category_id"],
    ["skus_sku_generations", "snapshot_version"],
  ];
  for (const [table, col] of colProbes) {
    const { data, error } = await sb.from(table).select(col).limit(1);
    checks[`col_${table}.${col}`] = error ? { error: error.message } : { ok: true, sample: data };
  }

  // words by field type
  const { data: fts } = await sb.from("skus_field_types").select("id,code");
  const byCode = Object.fromEntries((fts||[]).map(f => [f.id, f.code]));
  const { data: words } = await sb.from("skus_words").select("id,default_field_type_id,reference_code,label");
  const dist = {};
  for (const w of words||[]) {
    const c = byCode[w.default_field_type_id] || "UNKNOWN";
    dist[c] = (dist[c]||0)+1;
  }
  checks.words_by_field_type = dist;
  checks.words_family = (words||[]).filter(w => byCode[w.default_field_type_id]==="family").slice(0,10);

  // rpc exists?
  for (const fn of ["claim_sku_normalization","renew_sku_normalization_claim","release_sku_normalization_claim","skus_has_min_role"]) {
    const { error } = await sb.rpc(fn, fn.includes("claim") || fn.includes("renew") || fn.includes("release") ? { p_normalization_id: "00000000-0000-0000-0000-000000000000" } : { required_role: "editor" });
    checks[`rpc_${fn}`] = error ? { message: error.message, code: error.code, details: error.details } : { ok: true };
  }

  console.log(JSON.stringify(checks, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
