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
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing url/service key");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    "skus_roles",
    "skus_permissions",
    "skus_role_permissions",
    "skus_profiles",
    "skus_field_types",
    "skus_words",
    "skus_sku_sequences",
    "skus_sku_generations",
    "skus_sku_generation_measurement_history",
    "skus_admin_audit_logs",
    "skus_categories",
    "skus_category_levels",
    "skus_normalization_import_batches",
    "skus_code_normalizations",
  ];

  const report = { project: url.replace(/^https:\/\//, "").split(".")[0], scope: "skus_only" };

  for (const t of tables) {
    const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) report[t] = { ok: false, code: error.code, message: error.message };
    else report[t] = { ok: true, count };
  }

  for (const t of [
    "skus_field_types",
    "skus_words",
    "skus_sku_generations",
    "skus_profiles",
    "skus_roles",
  ]) {
    if (!report[t]?.ok) continue;
    const { data, error } = await sb.from(t).select("*").limit(1);
    report[`${t}_sample_keys`] = error ? error.message : data?.[0] ? Object.keys(data[0]) : [];
  }

  if (report.skus_field_types?.ok) {
    const { data } = await sb.from("skus_field_types").select("code,id").order("code");
    report.field_types = data;
  }
  if (report.skus_roles?.ok) {
    const { data } = await sb.from("skus_roles").select("id,code,name");
    report.roles = data;
  }

  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
