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

const TEST_EMAILS = [
  "skus.viewer.test@ggmpi.local",
  "skus.editor.test@ggmpi.local",
  "skus.editor2.test@ggmpi.local",
  "skus.manager.test@ggmpi.local",
  "skus.admin.test@ggmpi.local",
  "skus.inactive.test@ggmpi.local",
  "skus.noprofile.test@ggmpi.local",
];

(async () => {
  const env = loadEnv(".env.test-supabase");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report = { scope: "skus_only_cleanup" };

  // delete test normalizations + batches
  const { data: batches } = await admin
    .from("skus_normalization_import_batches")
    .select("id,file_name")
    .eq("file_name", "phase1a-test-fixture.xlsx");
  report.batches_found = batches || [];
  for (const b of batches || []) {
    const { error: e1 } = await admin.from("skus_code_normalizations").delete().eq("import_batch_id", b.id);
    if (e1) throw e1;
    const { error: e2 } = await admin.from("skus_normalization_import_batches").delete().eq("id", b.id);
    if (e2) throw e2;
  }

  // also any LOCK-CHK / TEST-LEGACY leftovers
  await admin.from("skus_code_normalizations").delete().like("legacy_code", "TEST-LEGACY-%");
  await admin.from("skus_code_normalizations").delete().eq("legacy_code", "LOCK-CHK");

  const { count: batchCount } = await admin
    .from("skus_normalization_import_batches")
    .select("*", { count: "exact", head: true });
  const { count: normCount } = await admin
    .from("skus_code_normalizations")
    .select("*", { count: "exact", head: true });
  report.after = { batches: batchCount, normalizations: normCount };

  // delete test profiles then auth users
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const testUsers = (listed.users || []).filter((u) => TEST_EMAILS.includes(u.email));
  report.auth_users_found = testUsers.map((u) => u.email);

  for (const u of testUsers) {
    await admin.from("skus_profiles").delete().eq("id", u.id);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) {
      // fallback: ban/disable
      await admin.auth.admin.updateUserById(u.id, { ban_duration: "876000h" });
      report["delete_failed_" + u.email] = error.message;
    }
  }

  // verify preserved data
  const { count: cats } = await admin.from("skus_categories").select("*", { count: "exact", head: true });
  const { count: levels } = await admin.from("skus_category_levels").select("*", { count: "exact", head: true });
  const { count: words } = await admin.from("skus_words").select("*", { count: "exact", head: true });
  const { count: wordsNull } = await admin
    .from("skus_words")
    .select("*", { count: "exact", head: true })
    .is("category_level_id", null);
  const { count: gens } = await admin.from("skus_sku_generations").select("*", { count: "exact", head: true });
  const { count: gensNull } = await admin
    .from("skus_sku_generations")
    .select("*", { count: "exact", head: true })
    .is("category_id", null);

  report.preserved = {
    categories: cats,
    levels,
    words,
    words_null_level: wordsNull,
    generations: gens,
    generations_null_category: gensNull,
  };

  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
