/**
 * Escapes a single CSV cell safely per RFC-4180 and neutralizes spreadsheet
 * formula injection (cells starting with =, +, -, @, tab, or CR).
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = value instanceof Date ? value.toISOString() : String(value);

  // Guard against Excel/Sheets CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of plain objects into an RFC-4180 CSV string.
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{ key: string, header: string }>} columns
 */
export function toCsv(rows, columns) {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key])).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}
