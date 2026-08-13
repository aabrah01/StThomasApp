import * as XLSX from 'xlsx';

export interface ContributionRow {
  familyName?: string;
  membershipId?: string;
  date: string;
  amount: string;
  category: string;
  sourceRow?: number;
}

export interface ParseResult {
  rows: ContributionRow[];
  error?: string;
}

/**
 * Parse a QuickBooks summary export (one row per family, categories as columns).
 *
 * The sheet has no per-row date, so `importDate` is stamped on every row — the
 * admin picks it when uploading by hand; the scheduled import uses the Drive
 * file's modifiedTime.
 *
 * Runs in both the browser (manual upload preview) and Node (scheduled import).
 */
export function parseContributionWorkbook(data: Uint8Array, importDate: string): ParseResult {
  const workbook = XLSX.read(data, { type: 'array' });

  // QuickBooks exports include a "tips" sheet first — pick the sheet with the most rows
  const sheetName = workbook.SheetNames.reduce((best, name) => {
    const s = workbook.Sheets[name];
    const ref = s['!ref'];
    if (!ref) return best;
    const rows = XLSX.utils.decode_range(ref).e.r;
    const bestRows = workbook.Sheets[best]['!ref']
      ? XLSX.utils.decode_range(workbook.Sheets[best]['!ref']!).e.r
      : 0;
    return rows > bestRows ? name : best;
  }, workbook.SheetNames[0]);
  const sheet = workbook.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
  if (raw.length < 3) {
    return { rows: [], error: 'File must have at least 3 rows (group header, column header, data).' };
  }

  const groupHeaders = (raw[0] as (string | number)[]).map(h => String(h ?? '').trim());
  const headers      = (raw[1] as (string | number)[]).map(h => String(h ?? '').trim());

  const catCols: { idx: number; name: string }[] = [];
  for (let i = 3; i < headers.length; i++) {
    const h = headers[i];
    if (/^total income$/i.test(h)) break;
    if (!h || /^total/i.test(h)) continue;
    const isSubAccount = /^\(.*\)$/.test(h);
    const name = isSubAccount
      ? (groupHeaders[i] || h.slice(1, -1)).trim()
      : h;
    catCols.push({ idx: i, name });
  }

  const rows: ContributionRow[] = [];
  for (let r = 2; r < raw.length - 1; r++) {
    const row = raw[r] as (string | number)[];
    const nameCell = String(row[1] ?? '').trim();
    if (!nameCell || /^total/i.test(nameCell)) continue;

    const idMatch = nameCell.match(/\s*-+\s*(\d+)\s*$/);
    const membershipId = idMatch ? idMatch[1] : undefined;
    const familyName = (idMatch ? nameCell.slice(0, idMatch.index) : nameCell).replace(/[-\s]+$/, '').trim();

    for (const { idx, name } of catCols) {
      const raw_val = row[idx];
      const amount = parseFloat(String(raw_val ?? '0').replace(/[$,]/g, ''));
      if (amount > 0) {
        rows.push({ membershipId, familyName, date: importDate, amount: String(amount), category: name, sourceRow: r + 1 });
      }
    }
  }

  if (rows.length === 0) {
    return { rows: [], error: 'No valid rows found. Check that the file matches the expected QuickBooks export format.' };
  }
  return { rows };
}
