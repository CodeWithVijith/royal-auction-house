import { it, expect } from 'vitest';
import { safeCell } from './results';
it('escapes spreadsheet formulas and leading whitespace without altering integer money', () => {
  for (const value of ['=1+1', '+cmd', '-1', '@SUM(A1)', '\t=HYPERLINK("x")'])
    expect(safeCell(value)).toBe("'" + value);
  expect(safeCell(2000)).toBe(2000);
  expect(safeCell('Alice')).toBe('Alice');
});
