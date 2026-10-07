// Cell-level helpers shared by the CSV and XLSX writers.

// Spreadsheet apps treat cells starting with these characters as formulas
// (CSV/Excel injection). Such cells get a leading apostrophe so they stay text.
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

export function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGERS.some((c) => value.startsWith(c)) ? `'${value}` : value;
}

function quoteCsv(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180-style CSV with CRLF line endings and formula neutralization. */
export function toCsv(rows: string[][], delimiter: string): string {
  return rows
    .map((row) => row.map((cell) => quoteCsv(neutralizeFormula(cell), delimiter)).join(delimiter))
    .join("\r\n")
    .concat("\r\n");
}

export type TextEncoding = "utf-8" | "windows-1251";

// windows-1251 for the Cyrillic alphabet; anything else non-ASCII becomes "?".
function encodeWindows1251(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let i = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    let byte: number;
    if (code < 0x80) byte = code;
    else if (code >= 0x0410 && code <= 0x044f) byte = code - 0x0410 + 0xc0; // А-я
    else if (code === 0x0401) byte = 0xa8; // Ё
    else if (code === 0x0451) byte = 0xb8; // ё
    else if (code === 0x2116) byte = 0xb9; // №
    else if (code === 0x2013) byte = 0x96; // –
    else if (code === 0x2014) byte = 0x97; // —
    else if (code === 0x201e) byte = 0x84; // „
    else if (code === 0x201c) byte = 0x93; // “
    else byte = 0x3f; // ?
    out[i++] = byte;
  }
  return out.subarray(0, i);
}

export function encodeText(text: string, encoding: TextEncoding, bom: boolean): Uint8Array {
  if (encoding === "windows-1251") return encodeWindows1251(text); // no BOM in single-byte encodings
  const body = new TextEncoder().encode(text);
  if (!bom) return body;
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}
