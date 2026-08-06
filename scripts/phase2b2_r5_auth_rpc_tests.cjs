/**
 * Fase 2B.2 R5 — Auth/RPC functional runner (Bloque 4 primera pasada)
 *
 * Env required:
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PHASE2B2_TEST_PASSWORD
 *   REFUSE_GGMPI_PRODUCTION_LIKE=true
 *   SUPABASE_PROJECT_REF   (explicit project ref)
 *
 * For authorized GGMPI window ONLY (after security gate 13/13):
 *   SUPABASE_PROJECT_REF=pmovliksftlcjvjxvqhm
 *   PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW=true
 *   REFUSE_GGMPI_PRODUCTION_LIKE=true
 *
 * Never prints tokens/passwords/JWT.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const GGMPI_REF = "pmovliksftlcjvjxvqhm";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!(k in process.env) || process.env[k] === "") process.env[k] = v;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.test-supabase"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

function env(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  throw new Error(`Missing required env: ${names.join(" | ")}`);
}

function maskUuid(id) {
  if (!id || typeof id !== "string") return "<missing>";
  if (id.length < 12) return "***";
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function assertProjectAllowed(url) {
  const urlRef = projectRefFromUrl(url);
  const declared = env("SUPABASE_PROJECT_REF");
  if (declared !== urlRef) {
    throw new Error(
      `SUPABASE_PROJECT_REF='${declared}' does not match URL host ref '${urlRef}'`
    );
  }

  const isGgmpi = declared === GGMPI_REF;
  const authorizedGgmpiWindow =
    (process.env.PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW || "").toLowerCase() === "true";
  const protectionEnabled =
    (process.env.REFUSE_GGMPI_PRODUCTION_LIKE || "").toLowerCase() === "true";

  if (!protectionEnabled) {
    throw new Error("REFUSE_GGMPI_PRODUCTION_LIKE must be true");
  }

  if (isGgmpi && !authorizedGgmpiWindow) {
    throw new Error("GGMPI execution refused: authorized window not enabled");
  }

  if (!isGgmpi && authorizedGgmpiWindow) {
    throw new Error("PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW only valid for GGMPI ref");
  }

  return { ref: declared, isGgmpi, authorizedGgmpiWindow };
}

function adminClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const USERS = [
  { key: "viewer", email: "phase2b2.viewer@ggmpi.local", role: "viewer", name: "P2B2 Viewer" },
  { key: "editor1", email: "phase2b2.editor1@ggmpi.local", role: "editor", name: "P2B2 Editor1" },
  { key: "editor2", email: "phase2b2.editor2@ggmpi.local", role: "editor", name: "P2B2 Editor2" },
  { key: "manager", email: "phase2b2.manager@ggmpi.local", role: "manager", name: "P2B2 Manager" },
  { key: "admin", email: "phase2b2.admin@ggmpi.local", role: "admin", name: "P2B2 Admin" },
  {
    key: "inactive",
    email: "phase2b2.inactive@ggmpi.local",
    role: "editor",
    name: "P2B2 Inactive",
    inactive: true,
  },
  { key: "noprofile", email: "phase2b2.noprofile@ggmpi.local", role: null, name: "P2B2 NoProfile" },
];

async function ensureUser(admin, u, password) {
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  let user = (listed.users || []).find((x) => x.email === u.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { skus_test: true, phase: "2b2-r5", role: u.role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
  }
  return user;
}

async function ensureProfile(admin, userId, roleId, u) {
  if (u.role == null) {
    await admin.from("skus_profiles").delete().eq("id", userId);
    return;
  }
  const row = {
    id: userId,
    role_id: roleId,
    name: u.name,
    email: u.email,
    department: "SKUS_TEST_P2B2",
    is_active: !u.inactive,
  };
  const { data: existing } = await admin.from("skus_profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    const { error } = await admin.from("skus_profiles").update(row).eq("id", userId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("skus_profiles").insert(row);
    if (error) throw error;
  }
}

async function signIn(url, anonKey, email, password) {
  const c = anonClient(url, anonKey);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

function summarizeError(error) {
  if (!error) return null;
  return String(error.message || error).slice(0, 300);
}

function errIncludes(error, needle) {
  return new RegExp(needle, "i").test(error?.message || String(error || ""));
}

async function findFreshPayload(admin) {
  const { data: category, error: catErr } = await admin
    .from("skus_categories")
    .select("id, slug, name")
    .eq("slug", "cosmetica")
    .eq("is_active", true)
    .maybeSingle();
  if (catErr) throw catErr;
  if (!category) throw new Error("category cosmetica not found");

  const { data: levels, error: levErr } = await admin
    .from("skus_category_levels")
    .select("id, key, label, sort_order, is_enabled, is_required, participates_in_code")
    .eq("category_id", category.id)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (levErr) throw levErr;
  if (!levels?.length) throw new Error("no enabled levels");

  const levelIds = levels.map((l) => l.id);
  const { data: words, error: wErr } = await admin
    .from("skus_words")
    .select("id, category_level_id, reference_code, is_active")
    .in("category_level_id", levelIds)
    .eq("is_active", true);
  if (wErr) throw wErr;

  const byLevel = new Map();
  for (const w of words || []) {
    const code = String(w.reference_code || "").trim().toUpperCase();
    if (!/^[A-Z0-9&.]{1,3}$/.test(code)) continue;
    if (!byLevel.has(w.category_level_id)) byLevel.set(w.category_level_id, []);
    byLevel.get(w.category_level_id).push({ id: w.id, reference_code: code });
  }

  const eligible = levels.filter((l) => (byLevel.get(l.id) || []).length > 0);
  if (eligible.length < 2) throw new Error("need >=2 eligible levels with words");

  const l1 = eligible[0];
  const l2 = eligible[1];
  const words1 = byLevel.get(l1.id);
  const words2 = byLevel.get(l2.id);

  const { data: existing } = await admin.from("skus_sku_generations").select("generated_code");
  const existingCodes = new Set((existing || []).map((r) => r.generated_code));

  for (const w1 of words1) {
    for (const w2 of words2) {
      const segments = levels
        .filter((l) => l.participates_in_code)
        .map((l) => {
          if (l.id === l1.id) return w1.reference_code;
          if (l.id === l2.id) return w2.reference_code;
          return "000";
        });
      const expectedCode = segments.join("-");
      if (existingCodes.has(expectedCode)) continue;

      const selections = {};
      for (const l of levels) {
        if (l.id === l1.id) selections[l.id] = { kind: "word", wordId: w1.id };
        else if (l.id === l2.id) selections[l.id] = { kind: "word", wordId: w2.id };
        else selections[l.id] = { kind: "empty" };
      }

      return {
        categoryId: category.id,
        expectedCode,
        selections,
        measures: {
          unitsPerBox: 12,
          unitsPerBoxStatus: "real",
          multiples: 6,
          multiplesStatus: "estimated",
          weight: 1.25,
          weightStatus: "real",
        },
      };
    }
  }

  throw new Error("NO_FRESH_COMBINATION");
}

async function cleanupRun(admin, ids, generationId, requestIds) {
  const deleted = { history: 0, generations: 0, profiles: 0, authUsers: 0 };

  if (requestIds.length) {
    const { data: hist } = await admin
      .from("skus_sku_generation_measurement_history")
      .select("id")
      .in("request_id", requestIds);
    if (hist?.length) {
      const { error } = await admin
        .from("skus_sku_generation_measurement_history")
        .delete()
        .in("id", hist.map((h) => h.id));
      if (!error) deleted.history = hist.length;
    }
  }

  if (generationId) {
    await admin.from("skus_sku_generation_measurement_history").delete().eq("sku_generation_id", generationId);
    const { error } = await admin.from("skus_sku_generations").delete().eq("id", generationId);
    if (!error) deleted.generations = 1;
  }

  for (const u of USERS) {
    const id = ids[u.key];
    if (!id) continue;
    await admin.from("skus_profiles").delete().eq("id", id);
    deleted.profiles += 1;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) deleted.authUsers += 1;
  }

  return deleted;
}

(async () => {
  const startedAt = new Date().toISOString();
  const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const password = env("PHASE2B2_TEST_PASSWORD");
  const testRunId = (process.env.PHASE2B2_TEST_RUN_ID || "").trim() || crypto.randomUUID();

  const project = assertProjectAllowed(url);
  const admin = adminClient(url, serviceKey);

  const { error: genProbeErr } = await admin.rpc("generate_sku_secure", { p_payload: {} });
  if (genProbeErr && /Could not find the function|schema cache/i.test(genProbeErr.message || "")) {
    throw new Error("generate_sku_secure missing — APPLY R5 first");
  }

  const { data: roles, error: rolesErr } = await admin.from("skus_roles").select("id,code");
  if (rolesErr) throw rolesErr;
  const roleByCode = Object.fromEntries((roles || []).map((r) => [r.code, r.id]));

  const ids = {};
  for (const u of USERS) {
    const user = await ensureUser(admin, u, password);
    ids[u.key] = user.id;
    await ensureProfile(admin, user.id, u.role ? roleByCode[u.role] : null, u);
  }

  const report = {
    scope: "phase2b2_r5_auth_rpc_pass1",
    environment_ref: project.ref,
    is_ggmpi: project.isGgmpi,
    authorized_ggmpi_window: project.authorizedGgmpiWindow,
    test_run_id: testRunId,
    started_at: startedAt,
    flag_v2: "false",
    users_masked: Object.fromEntries(
      USERS.map((u) => [u.key, { id: maskUuid(ids[u.key]), email: u.email, role: u.role }])
    ),
    cases: [],
  };

  const push = (name, ok, detail) => report.cases.push({ name, ok, detail });

  // --- Auth matrix on incomplete payload (expect denied vs invalid_payload) ---
  async function authCase(name, clientFactory, expectDenied) {
    try {
      const client = await clientFactory();
      const { error } = await client.rpc("generate_sku_secure", {
        p_payload: { requestId: crypto.randomUUID() },
      });
      if (expectDenied) {
        push(name, !!error && (errIncludes(error, "forbidden") || errIncludes(error, "permission") || errIncludes(error, "not_authenticated") || errIncludes(error, "JWT")), summarizeError(error));
      } else {
        push(name, !!error && errIncludes(error, "invalid_payload"), summarizeError(error));
      }
    } catch (e) {
      push(name, expectDenied, summarizeError(e));
    }
  }

  await authCase("anon_denied", async () => anonClient(url, anonKey), true);
  await authCase("viewer_denied", async () => signIn(url, anonKey, USERS[0].email, password), true);
  await authCase("inactive_denied", async () => signIn(url, anonKey, USERS[5].email, password), true);
  await authCase("noprofile_denied", async () => signIn(url, anonKey, USERS[6].email, password), true);
  await authCase("editor_reaches_validation", async () => signIn(url, anonKey, USERS[1].email, password), false);
  await authCase("manager_reaches_validation", async () => signIn(url, anonKey, USERS[3].email, password), false);
  await authCase("admin_reaches_validation", async () => signIn(url, anonKey, USERS[4].email, password), false);

  // --- Fresh generation + idempotency ---
  const fresh = await findFreshPayload(admin);
  report.expected_code = fresh.expectedCode;
  const editor = await signIn(url, anonKey, USERS[1].email, password);
  const r1 = crypto.randomUUID();
  const r2 = crypto.randomUUID();
  report.request_ids = { R1: r1, R2: r2 };

  const payloadBase = {
    categoryId: fresh.categoryId,
    selections: fresh.selections,
    measures: fresh.measures,
  };

  const g1 = await editor.rpc("generate_sku_secure", { p_payload: { ...payloadBase, requestId: r1 } });
  push(
    "editor_first_create",
    !g1.error && g1.data?.created === true && g1.data?.generatedCode === fresh.expectedCode,
    g1.error ? summarizeError(g1.error) : { created: g1.data?.created, code: g1.data?.generatedCode, generationId: maskUuid(g1.data?.generationId) }
  );

  const generationId = g1.data?.generationId || null;
  report.generation_id_masked = maskUuid(generationId);

  const g1b = await editor.rpc("generate_sku_secure", { p_payload: { ...payloadBase, requestId: r1 } });
  push(
    "editor_retry_same_request",
    !g1b.error && g1b.data?.created === false && g1b.data?.generationId === generationId,
    g1b.error ? summarizeError(g1b.error) : { created: g1b.data?.created, generationId: maskUuid(g1b.data?.generationId) }
  );

  const g2 = await editor.rpc("generate_sku_secure", { p_payload: { ...payloadBase, requestId: r2 } });
  push(
    "editor_new_request_same_combo",
    !g2.error && g2.data?.created === false && g2.data?.generationId === generationId,
    g2.error ? summarizeError(g2.error) : { created: g2.data?.created, generationId: maskUuid(g2.data?.generationId) }
  );

  if (generationId) {
    const { count: genCount } = await admin
      .from("skus_sku_generations")
      .select("id", { count: "exact", head: true })
      .eq("id", generationId);
    push("generation_count_one", genCount === 1, { count: genCount });

    const { data: histR1 } = await admin
      .from("skus_sku_generation_measurement_history")
      .select("field_name")
      .eq("request_id", r1);
    const { data: histR2 } = await admin
      .from("skus_sku_generation_measurement_history")
      .select("field_name")
      .eq("request_id", r2);
    push("history_r1_three_fields", (histR1 || []).length === 3, { count: (histR1 || []).length });
    push("history_r2_three_fields", (histR2 || []).length === 3, { count: (histR2 || []).length });
  }

  // Cleanup fixtures of this run
  const deleted = await cleanupRun(admin, ids, generationId, [r1, r2]);
  report.fixtures_deleted = deleted;

  const { count: leftoverProfiles } = await admin
    .from("skus_profiles")
    .select("id", { count: "exact", head: true })
    .like("email", "phase2b2.%");
  push("cleanup_profiles_zero", (leftoverProfiles || 0) === 0, { count: leftoverProfiles });

  if (generationId) {
    const { count: leftoverGen } = await admin
      .from("skus_sku_generations")
      .select("id", { count: "exact", head: true })
      .eq("id", generationId);
    push("cleanup_generation_zero", (leftoverGen || 0) === 0, { count: leftoverGen });
  }

  report.ended_at = new Date().toISOString();
  report.passed = report.cases.every((c) => c.ok);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }));
  process.exitCode = 1;
});
