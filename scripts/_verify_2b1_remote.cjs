const fs = require("fs");
const crypto = require("crypto");
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
  const report = { scope: "skus_only", migration: "20260805140000" };

  // selection_fingerprint column
  const { data: gen, error: e1 } = await sb.from("skus_sku_generations").select("id,selection_fingerprint,snapshot_version").limit(1);
  report.selection_fingerprint_col = e1 ? { error: e1.message } : { ok: true, sample: gen?.[0] ?? null };

  // nullable default_field_type_id: insert attempt with null should work if we have a level
  const { data: level } = await sb.from("skus_category_levels").select("id").limit(1).maybeSingle();
  report.has_level = !!level;

  // unique index existence - try inserting two gens with same fingerprint should fail later; for now just check column accepts null
  const { count: wordsNullFt } = await sb.from("skus_words").select("*", { count: "exact", head: true }).is("default_field_type_id", null);
  report.words_with_null_field_type = wordsNullFt;

  const { count: words } = await sb.from("skus_words").select("*", { count: "exact", head: true });
  const { count: gens } = await sb.from("skus_sku_generations").select("*", { count: "exact", head: true });
  report.preserved = { words, generations: gens };

  // sha256 of migration file for ledger
  const sql = fs.readFileSync("supabase/migrations/20260805140000_phase2b1_fingerprint_and_nullable_field_type.sql");
  report.sha256 = crypto.createHash("sha256").update(sql).digest("hex");

  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
