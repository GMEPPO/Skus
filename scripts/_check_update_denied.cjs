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
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row } = await admin
    .from("skus_code_normalizations")
    .select("id,legacy_code")
    .eq("legacy_code", "TEST-LEGACY-002")
    .maybeSingle();
  console.log("before", row);

  const { data: auth, error: signErr } = await anon.auth.signInWithPassword({
    email: "skus.editor.test@ggmpi.local",
    password: "SkusTest-Phase1A-2026!",
  });
  if (signErr) throw signErr;

  const { data: upd, error: updErr, count, status } = await anon
    .from("skus_code_normalizations")
    .update({ legacy_code: "HACKED-BY-EDITOR" })
    .eq("id", row.id)
    .select();
  console.log("update_result", { updErr, upd, status });

  const { data: after } = await admin.from("skus_code_normalizations").select("id,legacy_code").eq("id", row.id).single();
  console.log("after", after);
  console.log("mutated", after.legacy_code !== row.legacy_code);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
