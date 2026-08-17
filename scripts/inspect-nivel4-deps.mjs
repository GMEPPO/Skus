import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const files = [
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 4.xlsx",
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 2.xlsx",
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\nivel 1.xlsx",
];

for (const p of files) {
  const wb = XLSX.readFile(p);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  console.log("\n===", p.split("\\").pop(), "rows", rows.length, "===");
  console.log("cols:", rows[0] ? Object.keys(rows[0]) : []);
  for (const r of rows) {
    const text = JSON.stringify(r);
    if (/375|5L|5l|ECS|ECO|REC|Regras|regra|nivel|Ecosouc|Ecosource/i.test(text)) {
      console.log(r);
    }
  }
}
