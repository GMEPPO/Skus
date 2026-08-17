import XLSX from "xlsx";

const file = String.raw`c:\Users\mviera\OneDrive - Groupe GM\PCsEquipment\MiguelViera\Desktop\nivel 1.xlsx`;
const wb = XLSX.readFile(file);
console.log("Sheets:", wb.SheetNames);
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  console.log(`\n--- ${name} (${rows.length} rows) ---`);
  if (rows[0]) console.log("Columns:", Object.keys(rows[0]));
  console.log(JSON.stringify(rows.slice(0, 8), null, 2));
}
