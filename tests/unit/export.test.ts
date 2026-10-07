import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildExport } from "@/lib/export/build";
import { encodeText, neutralizeFormula, toCsv } from "@/lib/export/cells";
import {
  exportProfiles,
  joystickProfile,
  standardProfile,
  toRows,
  type ExportProfile,
  type ExportRecord,
} from "@/lib/export/profiles";

const records: ExportRecord[] = [
  {
    full_name: "Иван Иванов",
    phone: "+359888123456",
    email: "ivan@example.invalid",
    workplace: "Фирма; Отдел \"Продажби\"",
    starts_at: "2026-10-15T06:00:00.000Z",
    notes: '=HYPERLINK("http://evil")',
    status: "confirmed",
    created_at: "2026-10-07T11:32:00.000Z",
  },
  {
    full_name: "Мария Петрова",
    phone: "+442079460958",
    email: "maria@example.invalid",
    workplace: null,
    starts_at: "2026-10-26T07:30:00.000Z",
    notes: "ред 1\nред 2",
    status: "cancelled",
    created_at: "2026-10-07T12:00:00.000Z",
  },
];

describe("neutralizeFormula", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])("prefixes %j", (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it("leaves normal text alone", () => {
    expect(neutralizeFormula("Иван")).toBe("Иван");
    expect(neutralizeFormula("0888 123 456")).toBe("0888 123 456");
    expect(neutralizeFormula("a=b")).toBe("a=b");
  });
});

describe("standard profile rows", () => {
  it("has the agreed columns in order", () => {
    expect(toRows(standardProfile, [])[0]).toEqual([
      "Име и фамилия",
      "Телефон",
      "Имейл",
      "Работно място",
      "Дата",
      "Час",
      "Допълнително",
      "Статус",
      "Записан на",
    ]);
  });

  it("formats dates, times, phones and statuses in Bulgarian / Sofia time", () => {
    const [, first, second] = toRows(standardProfile, records);
    expect(first).toEqual([
      "Иван Иванов",
      "0888 123 456",
      "ivan@example.invalid",
      'Фирма; Отдел "Продажби"',
      "15.10.2026",
      "09:00",
      '=HYPERLINK("http://evil")',
      "Потвърден",
      "07.10.2026 14:32",
    ]);
    // Winter time after 25.10.2026: 07:30 UTC = 09:30 Sofia.
    expect(second.slice(1, 8)).toEqual(["+44 20 7946 0958", "maria@example.invalid", "", "26.10.2026", "09:30", "ред 1\nред 2", "Отменен"]);
  });

  it("keeps header and field separate, so profiles can rename and reorder", () => {
    const custom: ExportProfile = {
      ...standardProfile,
      columns: [
        { header: "Дата на прегледа", field: "starts_at", format: (v) => String(v).slice(0, 10) },
        { header: "Пациент", field: "full_name" },
      ],
    };
    expect(toRows(custom, records)[1]).toEqual(["2026-10-15", "Иван Иванов"]);
  });

  it("JOYSTICK is registered and starts as a copy of the standard profile", () => {
    expect(exportProfiles.joystick).toBe(joystickProfile);
    expect(toRows(joystickProfile, records)).toEqual(toRows(standardProfile, records));
  });
});

describe("CSV", () => {
  it("uses ; and CRLF, quotes special values and neutralizes formulas", () => {
    const csv = toCsv(toRows(standardProfile, records), ";");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Име и фамилия;Телефон;Имейл;Работно място;Дата;Час;Допълнително;Статус;Записан на");
    expect(lines[1]).toBe(
      'Иван Иванов;0888 123 456;ivan@example.invalid;"Фирма; Отдел ""Продажби""";15.10.2026;09:00;"\'=HYPERLINK(""http://evil"")";Потвърден;07.10.2026 14:32',
    );
    // Newlines inside a value stay inside one quoted cell.
    expect(csv).toContain('"ред 1\nред 2"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes UTF-8 with BOM for the Bulgarian Excel", async () => {
    const file = await buildExport(standardProfile, "csv", records);
    expect([...file.body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(file.body.slice(3))).toContain("Иван Иванов");
    expect(file.contentType).toBe("text/csv; charset=utf-8");
  });

  it("can encode windows-1251 when a profile asks for it", () => {
    const bytes = encodeText("Иван ё №1 – €", "windows-1251", true);
    expect([...bytes]).toEqual([0xc8, 0xe2, 0xe0, 0xed, 0x20, 0xb8, 0x20, 0xb9, 0x31, 0x20, 0x96, 0x20, 0x3f]);
  });
});

describe("XLSX", () => {
  it("is a valid workbook with the header and text values", async () => {
    const file = await buildExport(standardProfile, "xlsx", records);
    expect(file.extension).toBe("xlsx");

    const zip = unzipSync(file.body);
    expect(Object.keys(zip)).toContain("xl/worksheets/sheet1.xml");
    const xml = Object.entries(zip)
      .filter(([name]) => name.startsWith("xl/"))
      .map(([, data]) => strFromU8(data))
      .join("\n");
    for (const text of ["Име и фамилия", "Записан на", "Иван Иванов", "0888 123 456", "15.10.2026", "Отменен"]) {
      expect(xml).toContain(text);
    }
    // The formula-like note is stored as neutralized text, never as a formula.
    expect(xml).not.toMatch(/<f>/);
    expect(xml).toContain("'=HYPERLINK");
  });
});
