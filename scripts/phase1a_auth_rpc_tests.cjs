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

function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TEST_PASSWORD = "SkusTest-Phase1A-2026!";
const USERS = [
  { key: "viewer", email: "skus.viewer.test@ggmpi.local", role: "viewer", name: "SKUS Viewer Test" },
  { key: "editor", email: "skus.editor.test@ggmpi.local", role: "editor", name: "SKUS Editor Test" },
  { key: "editor2", email: "skus.editor2.test@ggmpi.local", role: "editor", name: "SKUS Editor2 Test" },
  { key: "manager", email: "skus.manager.test@ggmpi.local", role: "manager", name: "SKUS Manager Test" },
  { key: "admin", email: "skus.admin.test@ggmpi.local", role: "admin", name: "SKUS Admin Test" },
  { key: "inactive", email: "skus.inactive.test@ggmpi.local", role: "editor", name: "SKUS Inactive Test", inactive: true },
];

async function ensureUser(admin, u) {
  // list by email
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  let user = (listed.users || []).find((x) => x.email === u.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { skus_test: true, role: u.role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  }
  return user;
}

async function ensureProfile(admin, userId, roleId, u) {
  const { data: existing } = await admin.from("skus_profiles").select("*").eq("id", userId).maybeSingle();
  const row = {
    id: userId,
    role_id: roleId,
    name: u.name,
    email: u.email,
    department: "SKUS_TEST",
    is_active: !u.inactive,
  };
  if (existing) {
    const { error } = await admin.from("skus_profiles").update(row).eq("id", userId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("skus_profiles").insert(row);
    if (error) throw error;
  }
}

async function signIn(env, email) {
  const c = anonClient(env);
  const { data, error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return c;
}

function errMsg(error) {
  if (!error) return null;
  return error.message || String(error);
}

(async () => {
  const env = loadEnv(".env.test-supabase");
  const admin = adminClient(env);
  const report = { scope: "skus_only", project: "GGMPI", cases: [] };

  // roles
  const { data: roles, error: rolesErr } = await admin.from("skus_roles").select("id,code");
  if (rolesErr) throw rolesErr;
  const roleByCode = Object.fromEntries(roles.map((r) => [r.code, r.id]));

  // ensure users + profiles (Auth users are OK; only skus_profiles touched in public)
  const ids = {};
  for (const u of USERS) {
    const user = await ensureUser(admin, u);
    ids[u.key] = user.id;
    await ensureProfile(admin, user.id, roleByCode[u.role], u);
  }
  report.users = Object.fromEntries(USERS.map((u) => [u.key, { id: ids[u.key], email: u.email }]));

  // cosmética category
  const { data: cosmetica } = await admin.from("skus_categories").select("id").eq("slug", "cosmetica").single();

  // fixture batch + rows (only skus_* )
  const sha = "a".repeat(64);
  // clean previous test batch if any
  const { data: oldBatches } = await admin
    .from("skus_normalization_import_batches")
    .select("id")
    .eq("file_name", "phase1a-test-fixture.xlsx");
  for (const b of oldBatches || []) {
    await admin.from("skus_code_normalizations").delete().eq("import_batch_id", b.id);
    await admin.from("skus_normalization_import_batches").delete().eq("id", b.id);
  }

  const { data: batch, error: batchErr } = await admin
    .from("skus_normalization_import_batches")
    .insert({
      file_name: "phase1a-test-fixture.xlsx",
      file_sha256: sha,
      status: "completed",
      total_rows: 4,
      pending_rows: 2,
      completed_rows: 1,
      invalid_rows: 1,
      imported_by: ids.admin,
      completed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (batchErr) throw batchErr;

  const rows = [
    { source_row_number: 1, legacy_code: "TEST-LEGACY-001", normalization_status: "pending", category_id: cosmetica.id },
    { source_row_number: 2, legacy_code: "TEST-LEGACY-002", normalization_status: "pending", category_id: cosmetica.id },
    {
      source_row_number: 3,
      legacy_code: "TEST-LEGACY-003",
      normalization_status: "completed",
      category_id: cosmetica.id,
      final_new_code: "DONE-001",
      completed_by: ids.admin,
      completed_at: new Date().toISOString(),
    },
    {
      source_row_number: 4,
      legacy_code: null,
      normalization_status: "cancelled",
      import_issue: "MISSING_LEGACY_CODE",
      category_id: cosmetica.id,
    },
  ];

  const { data: norms, error: normErr } = await admin
    .from("skus_code_normalizations")
    .insert(rows.map((r) => ({ ...r, import_batch_id: batch.id })))
    .select("*");
  if (normErr) throw normErr;
  const byRow = Object.fromEntries(norms.map((n) => [n.source_row_number, n]));
  report.fixtures = { batch_id: batch.id, norms: Object.keys(byRow) };

  const push = (name, ok, detail) => report.cases.push({ name, ok, detail });

  // --- Auth/RPC cases ---
  const viewer = await signIn(env, USERS[0].email);
  const editor = await signIn(env, USERS[1].email);
  const editor2 = await signIn(env, USERS[2].email);
  const inactive = await signIn(env, USERS[5].email);

  // viewer claim -> forbidden
  {
    const { error } = await viewer.rpc("claim_sku_normalization", { p_normalization_id: byRow[1].id });
    push("viewer_claim_forbidden", !!error && /forbidden/i.test(error.message), errMsg(error));
  }

  // editor claim free pending -> success
  {
    const { data, error } = await editor.rpc("claim_sku_normalization", { p_normalization_id: byRow[1].id });
    push("editor_claim_free", !error && data?.locked_by === ids.editor, error ? errMsg(error) : { locked_by: data.locked_by });
  }

  // other editor claim active lock -> locked_by_other_user
  {
    const { error } = await editor2.rpc("claim_sku_normalization", { p_normalization_id: byRow[1].id });
    push("other_editor_blocked", !!error && /locked_by_other_user/i.test(error.message), errMsg(error));
  }

  // owner re-claim -> success renews
  {
    const { data, error } = await editor.rpc("claim_sku_normalization", { p_normalization_id: byRow[1].id });
    push("owner_reclaim", !error && data?.locked_by === ids.editor, error ? errMsg(error) : { expires: data.lock_expires_at });
  }

  // owner renew -> success
  {
    const { data, error } = await editor.rpc("renew_sku_normalization_claim", { p_normalization_id: byRow[1].id });
    push("owner_renew", !error && !!data?.lock_expires_at, error ? errMsg(error) : { expires: data.lock_expires_at });
  }

  // other renew -> error
  {
    const { error } = await editor2.rpc("renew_sku_normalization_claim", { p_normalization_id: byRow[1].id });
    push("other_renew_fail", !!error, errMsg(error));
  }

  // expire lock via service role, then renew fails, then other can claim
  {
    const past = new Date(Date.now() - 60_000).toISOString();
    const lockedAt = new Date(Date.now() - 120_000).toISOString();
    const { error: upErr } = await admin
      .from("skus_code_normalizations")
      .update({ locked_by: ids.editor, locked_at: lockedAt, lock_expires_at: past })
      .eq("id", byRow[1].id);
    if (upErr) push("fixture_expire_lock", false, upErr.message);
    else {
      const { error: renewErr } = await editor.rpc("renew_sku_normalization_claim", { p_normalization_id: byRow[1].id });
      push("renew_expired_fails", !!renewErr && /renew_failed/i.test(renewErr.message), errMsg(renewErr));

      const { data, error } = await editor2.rpc("claim_sku_normalization", { p_normalization_id: byRow[1].id });
      push("other_claims_expired", !error && data?.locked_by === ids.editor2, error ? errMsg(error) : { locked_by: data.locked_by });
    }
  }

  // other cannot release editor2's lock - use editor trying to release row1 owned by editor2
  {
    const { error } = await editor.rpc("release_sku_normalization_claim", { p_normalization_id: byRow[1].id });
    push("other_release_fail", !!error && /release_failed/i.test(error.message), errMsg(error));
  }

  // owner release pending -> success
  {
    const { data, error } = await editor2.rpc("release_sku_normalization_claim", { p_normalization_id: byRow[1].id });
    push("owner_release_pending", !error && data?.locked_by == null, error ? errMsg(error) : { locked_by: data.locked_by });
  }

  // release completed / cancelled -> fail
  {
    // first claim completed? shouldn't work for claim either; for release set a lock via admin then try release
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 600_000).toISOString();
    await admin
      .from("skus_code_normalizations")
      .update({ locked_by: ids.editor, locked_at: now, lock_expires_at: exp })
      .eq("id", byRow[3].id);
    const { error: eCompleted } = await editor.rpc("release_sku_normalization_claim", { p_normalization_id: byRow[3].id });
    push("release_completed_fail", !!eCompleted, errMsg(eCompleted));

    await admin
      .from("skus_code_normalizations")
      .update({ locked_by: ids.editor, locked_at: now, lock_expires_at: exp })
      .eq("id", byRow[4].id);
    const { error: eCancelled } = await editor.rpc("release_sku_normalization_claim", { p_normalization_id: byRow[4].id });
    push("release_cancelled_fail", !!eCancelled, errMsg(eCancelled));

    // cleanup locks on completed/cancelled via admin
    await admin
      .from("skus_code_normalizations")
      .update({ locked_by: null, locked_at: null, lock_expires_at: null })
      .in("id", [byRow[3].id, byRow[4].id]);
  }

  // authenticated direct UPDATE: PostgREST may return 200 with 0 rows under RLS;
  // the contract is that data must NOT mutate.
  {
    const before = byRow[2].legacy_code;
    const { error } = await editor.from("skus_code_normalizations").update({ legacy_code: "HACK" }).eq("id", byRow[2].id);
    const { data: after } = await admin.from("skus_code_normalizations").select("legacy_code").eq("id", byRow[2].id).single();
    push("authenticated_update_denied", after?.legacy_code === before, {
      api_error: errMsg(error),
      before,
      after: after?.legacy_code,
    });
  }

  // anon RPC denied
  {
    const anon = anonClient(env);
    const { error } = await anon.rpc("claim_sku_normalization", { p_normalization_id: byRow[2].id });
    push("anon_rpc_denied", !!error, errMsg(error));
  }

  // inactive profile claim -> forbidden
  {
    const { error } = await inactive.rpc("claim_sku_normalization", { p_normalization_id: byRow[2].id });
    push("inactive_forbidden", !!error && /forbidden/i.test(error.message), errMsg(error));
  }

  // user without profile: create auth user without skus_profiles
  {
    const email = "skus.noprofile.test@ggmpi.local";
    let user = (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users.find((x) => x.email === email);
    if (!user) {
      const { data } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
      user = data.user;
    }
    await admin.from("skus_profiles").delete().eq("id", user.id);
    const c = await signIn(env, email);
    const { error } = await c.rpc("claim_sku_normalization", { p_normalization_id: byRow[2].id });
    push("no_profile_forbidden", !!error && /forbidden/i.test(error.message), errMsg(error));
  }

  // concurrency Promise.allSettled on free row 2
  {
    // ensure row2 free
    await admin
      .from("skus_code_normalizations")
      .update({ locked_by: null, locked_at: null, lock_expires_at: null })
      .eq("id", byRow[2].id);

    const results = await Promise.allSettled([
      editor.rpc("claim_sku_normalization", { p_normalization_id: byRow[2].id }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
      editor2.rpc("claim_sku_normalization", { p_normalization_id: byRow[2].id }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
    ]);
    const fulfilled = results.filter((x) => x.status === "fulfilled").length;
    const rejected = results.filter((x) => x.status === "rejected").length;
    push("concurrency_one_winner", fulfilled === 1 && rejected === 1, {
      fulfilled,
      rejected,
      details: results.map((x) =>
        x.status === "fulfilled" ? { ok: true, locked_by: x.value.locked_by } : { ok: false, reason: x.reason?.message || String(x.reason) },
      ),
    });
  }

  // lock consistency constraints via service role inserts that should fail
  {
    const base = {
      import_batch_id: batch.id,
      source_row_number: 100,
      legacy_code: "LOCK-CHK",
      normalization_status: "pending",
      category_id: cosmetica.id,
    };
    // partial lock: locked_by set, timestamps null
    let { error } = await admin.from("skus_code_normalizations").insert({
      ...base,
      source_row_number: 101,
      locked_by: ids.editor,
    });
    push("constraint_partial_locked_by", !!error, errMsg(error));

    ({ error } = await admin.from("skus_code_normalizations").insert({
      ...base,
      source_row_number: 102,
      locked_at: new Date().toISOString(),
    }));
    push("constraint_locked_at_only", !!error, errMsg(error));

    const t = new Date().toISOString();
    ({ error } = await admin.from("skus_code_normalizations").insert({
      ...base,
      source_row_number: 103,
      locked_by: ids.editor,
      locked_at: t,
      lock_expires_at: t,
    }));
    push("constraint_expires_eq_locked", !!error, errMsg(error));

    const lockedAt = new Date().toISOString();
    const earlier = new Date(Date.now() - 1000).toISOString();
    ({ error } = await admin.from("skus_code_normalizations").insert({
      ...base,
      source_row_number: 104,
      locked_by: ids.editor,
      locked_at: lockedAt,
      lock_expires_at: earlier,
    }));
    push("constraint_expires_before_locked", !!error, errMsg(error));

    const lockedAt2 = new Date().toISOString();
    const later = new Date(Date.now() + 600_000).toISOString();
    ({ error } = await admin.from("skus_code_normalizations").insert({
      ...base,
      source_row_number: 105,
      locked_by: ids.editor,
      locked_at: lockedAt2,
      lock_expires_at: later,
    }));
    push("constraint_valid_lock_ok", !error, errMsg(error));
    if (!error) {
      await admin.from("skus_code_normalizations").delete().eq("import_batch_id", batch.id).eq("source_row_number", 105);
    }
  }

  // levels other categories = 0
  {
    const { data: cats } = await admin.from("skus_categories").select("id,slug");
    const { data: levels } = await admin.from("skus_category_levels").select("category_id");
    const counts = {};
    for (const c of cats) counts[c.slug] = 0;
    for (const l of levels) {
      const slug = cats.find((c) => c.id === l.category_id)?.slug;
      if (slug) counts[slug]++;
    }
    push(
      "levels_distribution",
      counts.cosmetica === 6 &&
        counts["dry-amenities"] === 0 &&
        counts.accesorios === 0 &&
        counts.equipamento === 0 &&
        counts.personalizados === 0,
      counts,
    );
  }

  report.passed = report.cases.filter((c) => c.ok).length;
  report.failed = report.cases.filter((c) => !c.ok).length;
  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exitCode = 2;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
