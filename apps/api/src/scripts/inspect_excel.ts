import XLSX from 'xlsx';

const workbook = XLSX.readFile('../../AFILIADOS 2026.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('--- INSPECCIONANDO EXCEL (Primeras 10 filas) ---');
console.log(JSON.stringify(rows.slice(0, 10), null, 2));
