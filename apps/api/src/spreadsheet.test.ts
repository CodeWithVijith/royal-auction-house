import { it, expect } from 'vitest';
import { normalizeRows, readSheets } from './spreadsheet';
it('requires one name mapping and rejects formula and invalid date cells', () => {
  const result = normalizeRows(
    [
      ['Name', 'DOB'],
      [{ formula: '1+1' }, '2000-01-01'],
      ['Valid', '2000-02-31'],
    ],
    0,
    { name: 0, dob: 1 },
  );
  expect(result.every((r) => r.errors.length > 0)).toBe(true);
});
it('parses quoted CSV cells and accepts explicit day/month/year dates', async () => {
  const sheets = await readSheets(
    Buffer.from('Name,DOB\n"Last, First",10/05/1995\n'),
    'csv',
  );
  const rows = normalizeRows(sheets[0]!.rows, 0, { name: 0, dob: 1 });
  expect(rows[0]?.player.name).toBe('Last, First');
  expect(rows[0]?.player.dob).toBe('1995-05-10');
});
