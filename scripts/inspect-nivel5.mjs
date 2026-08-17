import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 5.xlsx";

const wb = XLSX.readFile(EXCEL_PATH);
console.log("Sheets:", wb.SheetNames);

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  if (rows[0]) console.log("Columns:", Object.keys(rows[0]));
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}
