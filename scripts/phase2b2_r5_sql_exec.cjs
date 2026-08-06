#!/usr/bin/env node
/**
 * Ejecuta SQL contra GGMPI vía DATABASE_URL (ssl).
 * Uso: node scripts/phase2b2_r5_sql_exec.cjs <archivo.sql | ->
 *      node scripts/phase2b2_r5_sql_exec.cjs --inline "select 1"
 * Env: DATABASE_URL o SUPABASE_DB_PASSWORD (+ construye URL db.<ref>.supabase.co)
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const p = path.join(process.cwd(), ".env.test-supabase");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function resolveUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const pwd = (process.env.SUPABASE_DB_PASSWORD || "").trim();
  const ref =
    process.env.SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_TEST_PROJECT_REF ||
    "";
  const hostRef =
    ref === "GGMPI" || !ref ? "pmovliksftlcjvjxvqhm" : ref;
  if (!pwd) {
    throw new Error("Missing DATABASE_URL and SUPABASE_DB_PASSWORD");
  }
  const enc = encodeURIComponent(pwd);
  return `postgresql://postgres:${enc}@db.${hostRef}.supabase.co:5432/postgres`;
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  let sql = "";
  if (args[0] === "--inline") {
    sql = args.slice(1).join(" ");
  } else if (args[0] === "-") {
    sql = fs.readFileSync(0, "utf8");
  } else if (args[0]) {
    sql = fs.readFileSync(path.resolve(args[0]), "utf8");
  } else {
    throw new Error("Usage: phase2b2_r5_sql_exec.cjs <file.sql|--inline SQL|->");
  }
  // Strip section comments markers that are not executable alone — keep full file runnable
  // by only running statements that aren't pure comment blocks.
  const client = new Client({
    connectionString: resolveUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(sql);
    const out = Array.isArray(res)
      ? res.map((r) => ({ rowCount: r.rowCount, rows: r.rows }))
      : { rowCount: res.rowCount, rows: res.rows, fields: (res.fields || []).map((f) => f.name) };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
