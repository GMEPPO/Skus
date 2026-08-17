import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file = "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 4.xlsx";
const wb = XLSX.readFile(file);
console.log("Sheets:", wb.SheetNames);
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  console.log(`\n--- ${name} (${rows.length} rows) ---`);
  if (rows[0]) console.log("Columns:", Object.keys(rows[0]));
  for (const row of rows.slice(0, 10)) console.log(JSON.stringify(row));
  const obsCol = Object.keys(rows[0] || {}).find((k) => k.toLowerCase().includes("observ") || k === "__EMPTY");
  if (obsCol) {
    const values = [...new Set(rows.map((r) => String(r[obsCol] ?? "").trim()).filter(Boolean))];
    console.log("\nObs unique:", values);
  }
}
