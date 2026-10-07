import "server-only";

import writeExcelFile from "write-excel-file/node";

import { encodeText, neutralizeFormula, toCsv } from "@/lib/export/cells";
import { toRows, type ExportProfile, type ExportRecord } from "@/lib/export/profiles";

export type ExportFile = { body: Uint8Array; contentType: string; extension: "xlsx" | "csv" };

export async function buildExport(
  profile: ExportProfile,
  format: "xlsx" | "csv",
  records: ExportRecord[],
): Promise<ExportFile> {
  const rows = toRows(profile, records);

  if (format === "csv") {
    const { delimiter, encoding, bom } = profile.csv;
    return {
      body: encodeText(toCsv(rows, delimiter), encoding, bom),
      contentType: `text/csv; charset=${encoding}`,
      extension: "csv",
    };
  }

  // Every cell is written as text; formula-like values are neutralized too,
  // in case the sheet is later saved as CSV.
  const [header, ...body] = rows;
  const sheet = [
    header.map((value) => ({ value, type: String, fontWeight: "bold" as const })),
    ...body.map((row) => row.map((value) => ({ value: neutralizeFormula(value), type: String }))),
  ];
  const buffer = await writeExcelFile(sheet, {
    columns: profile.columns.map((c) => ({ width: c.width ?? 16 })),
    stickyRowsCount: 1,
    sheet: "Записвания",
  }).toBuffer();

  return {
    body: new Uint8Array(buffer),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}
