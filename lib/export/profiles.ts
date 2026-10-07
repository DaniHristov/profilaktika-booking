import { formatDate, formatTime } from "@/lib/datetime";
import { formatPhone } from "@/lib/format/phone";
import type { TextEncoding } from "@/lib/export/cells";

// Export profiles. Changing the JOYSTICK format (column names, order, date /
// time / phone format, delimiter, encoding) is an edit of this file only.

/** One booking as the export sees it. */
export type ExportRecord = {
  full_name: string;
  phone: string;
  email: string;
  workplace: string | null;
  starts_at: string; // ISO, UTC
  notes: string | null;
  status: string; // 'confirmed' | 'cancelled'
  created_at: string; // ISO, UTC
};

export type ExportField = keyof ExportRecord;

export type ExportColumn = {
  /** Column title in the file. */
  header: string;
  /** Source field. */
  field: ExportField;
  /** Optional formatter; the default turns null into "" and keeps strings. */
  format?: (value: ExportRecord[ExportField], record: ExportRecord) => string;
  /** XLSX column width in characters. */
  width?: number;
};

export type ExportProfile = {
  id: string;
  /** Button label in the admin panel. */
  label: string;
  /** File name without extension; the date is appended. ASCII only. */
  fileName: string;
  /** File type used by this profile's button. */
  format: "xlsx" | "csv";
  csv: { delimiter: string; encoding: TextEncoding; bom: boolean };
  columns: ExportColumn[];
};

// Reusable formatters (all in Europe/Sofia).
export const formatters = {
  /** "15.10.2026" */
  date: (value: unknown) => formatDate(new Date(String(value))),
  /** "09:00" */
  time: (value: unknown) => formatTime(new Date(String(value))),
  /** "07.10.2026 14:32" */
  dateTime: (value: unknown) => {
    const d = new Date(String(value));
    return `${formatDate(d)} ${formatTime(d)}`;
  },
  /** "0888 123 456" (BG), "+44 20 7946 0958" (foreign) */
  phone: (value: unknown) => formatPhone(String(value ?? "")),
  /** "+359888123456" */
  phoneE164: (value: unknown) => String(value ?? ""),
  /** "Потвърден" / "Отменен" */
  status: (value: unknown) => (value === "cancelled" ? "Отменен" : "Потвърден"),
} as const;

const standardColumns: ExportColumn[] = [
  { header: "Име и фамилия", field: "full_name", width: 28 },
  { header: "Телефон", field: "phone", format: formatters.phone, width: 18 },
  { header: "Имейл", field: "email", width: 30 },
  { header: "Работно място", field: "workplace", width: 24 },
  { header: "Дата", field: "starts_at", format: formatters.date, width: 12 },
  { header: "Час", field: "starts_at", format: formatters.time, width: 8 },
  { header: "Допълнително", field: "notes", width: 40 },
  { header: "Статус", field: "status", format: formatters.status, width: 12 },
  { header: "Записан на", field: "created_at", format: formatters.dateTime, width: 18 },
];

export const standardProfile: ExportProfile = {
  id: "standard",
  label: "Стандартен",
  fileName: "zapisvania",
  format: "xlsx",
  // Bulgarian Excel opens ";"-separated UTF-8 with BOM correctly.
  csv: { delimiter: ";", encoding: "utf-8", bom: true },
  columns: standardColumns,
};

// TODO(JOYSTICK): replace with the real import format once the sample import
// file from JOYSTICK is available. Until then it is a copy of the standard one.
export const joystickProfile: ExportProfile = {
  id: "joystick",
  label: "JOYSTICK",
  fileName: "joystick-import",
  format: "csv",
  csv: { delimiter: ";", encoding: "utf-8", bom: true },
  columns: standardColumns.map((c) => ({ ...c })),
};

export const exportProfiles: Record<string, ExportProfile> = {
  [standardProfile.id]: standardProfile,
  [joystickProfile.id]: joystickProfile,
};

/** Header row plus one row of formatted strings per record. */
export function toRows(profile: ExportProfile, records: ExportRecord[]): string[][] {
  const header = profile.columns.map((c) => c.header);
  const body = records.map((record) =>
    profile.columns.map((column) => {
      const value = record[column.field];
      if (column.format) return column.format(value, record);
      return value == null ? "" : String(value);
    }),
  );
  return [header, ...body];
}
