import Papa from "papaparse";

/**
 * Downloads UTF-8 CSV with BOM so Excel opens Arabic / special chars reliably.
 */
export function downloadCsvFile(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows, { header: true });
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
