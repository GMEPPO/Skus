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
  const r = { project: "GGMPI", scope: "skus_only" };

  // counts
  const { count: catCount, error: e1 } = await sb.from("skus_categories").select("*", { count: "exact", head: true });
  r.categories_count = e1 ? e1.message : catCount;

  const { data: levels, error: e2 } = await sb.from("skus_category_levels").select("id,key,label,is_required,is_enabled,category_id, skus_categories!inner(slug)");
  if (e2) {
    // fallback without embed
    const { data: levels2, error: e2b } = await sb.from("skus_category_levels").select("id,key,label,is_required,is_enabled,category_id");
    const { data: cats } = await sb.from("skus_categories").select("id,slug,sort_order");
    r.levels_error = e2.message;
    r.levels = levels2;
    r.cats = cats;
    const byCat = {};
    for (const c of cats || []) byCat[c.id] = { slug: c.slug, n: 0 };
    for (const l of levels2 || []) if (byCat[l.category_id]) byCat[l.category_id].n++;
    r.levels_by_slug = Object.values(byCat);
    r.required_true = (levels2 || []).filter(l => l.is_required).length;
  } else {
    r.levels_count = levels.length;
    r.required_true = levels.filter(l => l.is_required).length;
    const by = {};
    for (const l of levels) {
      const slug = l.skus_categories.slug;
      by[slug] = (by[slug] || 0) + 1;
    }
    r.levels_by_slug = by;
    r.levels_detail = levels.map(l => ({ key: l.key, required: l.is_required, slug: l.skus_categories.slug }));
  }

  // words null category_level_id
  const { count: wordsNull, error: e3 } = await sb.from("skus_words").select("*", { count: "exact", head: true }).is("category_level_id", null);
  r.words_null_category_level_id = e3 ? e3.message : wordsNull;
  const { count: wordsTotal } = await sb.from("skus_words").select("*", { count: "exact", head: true });
  r.words_total = wordsTotal;

  // generations
  const { count: genNull, error: e4 } = await sb.from("skus_sku_generations").select("*", { count: "exact", head: true }).is("category_id", null);
  r.generations_null_category_id = e4 ? e4.message : genNull;
  const { data: gens } = await sb.from("skus_sku_generations").select("id,snapshot_version,category_id,selection_snapshot,generated_code");
  r.generations = (gens || []).map(g => ({
    code: g.generated_code,
    snapshot_version: g.snapshot_version,
    category_id: g.category_id,
    has_snapshot: g.selection_snapshot != null,
  }));
  const versions = [...new Set((gens || []).map(g => g.snapshot_version))];
  r.distinct_snapshot_version = versions;

  // legacy columns still present
  const { data: w1, error: ew } = await sb.from("skus_words").select("id,default_field_type_id,category_level_id").limit(1);
  r.words_cols_ok = !ew && w1?.[0] && "default_field_type_id" in w1[0] && "category_level_id" in w1[0];

  // batches/normalizations exist empty
  for (const t of ["skus_normalization_import_batches", "skus_code_normalizations"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    r[t] = error ? error.message : { count };
  }

  // rpc exists
  const { error: rpcErr } = await sb.rpc("claim_sku_normalization", {
    p_normalization_id: "00000000-0000-0000-0000-000000000000",
  });
  r.rpc_claim_reachable = rpcErr ? { message: rpcErr.message, code: rpcErr.code } : { ok: true };

  // privileges can't be checked via REST easily; skip

  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
