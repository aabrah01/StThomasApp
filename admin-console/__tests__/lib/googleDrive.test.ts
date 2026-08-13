/**
 * Tests for Drive folder file selection.
 *
 * Network calls need service-account credentials and are not covered here; the
 * selection rules are the part with real logic.
 */
import { selectImportFile, hasOpenWorkbook, XLSX_MIME, type DriveFile } from '@/lib/googleDrive';

const NOW = new Date('2026-08-12T15:00:00Z');
const MB = 1024 * 1024;

const file = (over: Partial<DriveFile> = {}): DriveFile => ({
  id: 'id-1',
  name: 'Contributions YTD.xlsx',
  mimeType: XLSX_MIME,
  modifiedTime: '2026-08-12T12:00:00Z', // 3 hours old
  size: MB,
  ...over,
});

const select = (files: DriveFile[], minAgeMinutes = 15) =>
  selectImportFile(files, { minAgeMinutes, now: NOW });

describe('selectImportFile', () => {
  it('returns the only qualifying file', () => {
    expect(select([file()])?.id).toBe('id-1');
  });

  it('returns null for an empty folder', () => {
    expect(select([])).toBeNull();
  });

  it('picks the newest of several exports', () => {
    const chosen = select([
      file({ id: 'old', modifiedTime: '2026-08-01T12:00:00Z' }),
      file({ id: 'new', modifiedTime: '2026-08-10T12:00:00Z' }),
      file({ id: 'mid', modifiedTime: '2026-08-05T12:00:00Z' }),
    ]);
    expect(chosen?.id).toBe('new');
  });

  it('ignores Excel lock files even when they are the newest entry', () => {
    const chosen = select([
      file({ id: 'real', modifiedTime: '2026-08-12T12:00:00Z' }),
      file({ id: 'lock', name: '~$Contributions YTD.xlsx', size: 165, modifiedTime: '2026-08-12T12:30:00Z' }),
    ]);
    expect(chosen?.id).toBe('real');
  });

  it('ignores a lock file that is large enough to pass the size floor', () => {
    expect(select([file({ name: '~$Contributions.xlsx' })])).toBeNull();
  });

  it('ignores dotfiles', () => {
    expect(select([file({ name: '.DS_Store' })])).toBeNull();
  });

  it('ignores files below the size floor', () => {
    expect(select([file({ size: 200 })])).toBeNull();
  });

  it('ignores non-xlsx files', () => {
    expect(select([file({ name: 'notes.pdf', mimeType: 'application/pdf' })])).toBeNull();
  });

  it('ignores native Google Sheets, which report no size', () => {
    const sheet = file({ name: 'Contributions', mimeType: 'application/vnd.google-apps.spreadsheet', size: 0 });
    expect(select([sheet])).toBeNull();
  });

  it('ignores a file modified within the freshness window', () => {
    // 5 minutes old, window is 15
    expect(select([file({ modifiedTime: '2026-08-12T14:55:00Z' })])).toBeNull();
  });

  it('accepts a file just outside the freshness window', () => {
    // 16 minutes old
    expect(select([file({ modifiedTime: '2026-08-12T14:44:00Z' })])?.id).toBe('id-1');
  });

  it('skips the freshness check when minAgeMinutes is 0 (manual trigger)', () => {
    const justUploaded = file({ modifiedTime: '2026-08-12T14:59:30Z' });
    expect(select([justUploaded], 15)).toBeNull();
    expect(select([justUploaded], 0)?.id).toBe('id-1');
  });

  it('falls back to an older file when the newest is too fresh', () => {
    const chosen = select([
      file({ id: 'settled', modifiedTime: '2026-08-12T10:00:00Z' }),
      file({ id: 'uploading', modifiedTime: '2026-08-12T14:58:00Z' }),
    ]);
    expect(chosen?.id).toBe('settled');
  });
});

describe('hasOpenWorkbook', () => {
  it('detects a lock file', () => {
    expect(hasOpenWorkbook([file(), file({ name: '~$Contributions YTD.xlsx' })])).toBe(true);
  });

  it('is false for a folder with no lock file', () => {
    expect(hasOpenWorkbook([file()])).toBe(false);
  });

  it('is false for an empty folder', () => {
    expect(hasOpenWorkbook([])).toBe(false);
  });
});
