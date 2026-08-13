/**
 * Tests for the QuickBooks summary-export parser.
 */
import * as XLSX from 'xlsx';
import { parseContributionWorkbook } from '@/lib/parseContributionSheet';

const DATE = '2026-08-11';

/** Build an .xlsx in memory from an array-of-arrays sheet. */
const makeWorkbook = (rows: (string | number)[][], sheetName = 'Sheet1'): Uint8Array => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
};

// Row 0 = group headers, row 1 = column headers, rows 2..n-2 = data, last row = totals.
// Columns 0-2 are ignored by the parser; category columns start at index 3.
const SHEET = [
  ['',   '',                      '', '',              'Missions',   '',             ''],
  ['',   '',                      '', 'General Fund',  '(Building)', 'Total Income', ''],
  ['',   'Smith Family - 1001',   '', '100.00',        '50.00',      '150.00',       ''],
  ['',   'Johnson Family - 1002', '', '$1,250.00',     '0',          '1250.00',      ''],
  ['',   'Total',                 '', '1350.00',       '50.00',      '1400.00',      ''],
];

describe('parseContributionWorkbook', () => {
  it('parses one row per family per non-zero category', () => {
    const { rows, error } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    expect(error).toBeUndefined();
    // Smith: General + Building. Johnson: General only (Building is 0).
    expect(rows).toHaveLength(3);
  });

  it('splits the trailing membership id off the family name', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    expect(rows[0].familyName).toBe('Smith Family');
    expect(rows[0].membershipId).toBe('1001');
  });

  it('uses the group header as the category for sub-accounts', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    const categories = rows.map(r => r.category);
    expect(categories).toContain('General Fund');
    expect(categories).toContain('Missions');
    expect(categories).not.toContain('(Building)');
  });

  it('stops at the Total Income column and skips the totals row', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    expect(rows.map(r => r.category)).not.toContain('Total Income');
    expect(rows.map(r => r.familyName)).not.toContain('Total');
  });

  it('strips currency formatting from amounts', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    const johnson = rows.find(r => r.membershipId === '1002');
    expect(johnson?.amount).toBe('1250');
  });

  it('stamps the supplied import date on every row', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    expect(rows.every(r => r.date === DATE)).toBe(true);
  });

  it('reports source row numbers for error messages', () => {
    const { rows } = parseContributionWorkbook(makeWorkbook(SHEET), DATE);
    expect(rows[0].sourceRow).toBe(3);
  });

  it('handles a family name with no membership id suffix', () => {
    const sheet = [
      ['', '', '', '', ''],
      ['', '', '', 'General Fund', 'Total Income'],
      ['', 'Varghese Family', '', '75.00', '75.00'],
      ['', 'Total', '', '75.00', '75.00'],
    ];
    const { rows } = parseContributionWorkbook(makeWorkbook(sheet), DATE);
    expect(rows[0].familyName).toBe('Varghese Family');
    expect(rows[0].membershipId).toBeUndefined();
  });

  it('picks the sheet with the most rows (QB prepends a tips sheet)', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Tips'], ['Read me']]), 'Tips');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SHEET), 'Data');
    const data = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));

    const { rows, error } = parseContributionWorkbook(data, DATE);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(3);
  });

  it('errors on a file with fewer than 3 rows', () => {
    const { rows, error } = parseContributionWorkbook(makeWorkbook([['a'], ['b']]), DATE);
    expect(rows).toHaveLength(0);
    expect(error).toMatch(/at least 3 rows/);
  });

  it('errors when no data rows have positive amounts', () => {
    const sheet = [
      ['', '', '', '', ''],
      ['', '', '', 'General Fund', 'Total Income'],
      ['', 'Smith Family', '', '0', '0'],
      ['', 'Total', '', '0', '0'],
    ];
    const { rows, error } = parseContributionWorkbook(makeWorkbook(sheet), DATE);
    expect(rows).toHaveLength(0);
    expect(error).toMatch(/No valid rows found/);
  });
});
