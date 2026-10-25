import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import yauzl from 'yauzl';
import { z } from 'zod';
import { HttpError } from './errors';
export const MAX_ROWS = 5000;
export const fields = [
  'name',
  'registrationId',
  'dob',
  'previousTeam',
  'category',
  'playerPhotoURL',
] as const;
export type Field = (typeof fields)[number];
export const mappingSchema = z
  .object({
    name: z.number().int().min(0).max(199),
    registrationId: z.number().int().min(0).max(199).optional(),
    dob: z.number().int().min(0).max(199).optional(),
    previousTeam: z.number().int().min(0).max(199).optional(),
    category: z.number().int().min(0).max(199).optional(),
    playerPhotoURL: z.number().int().min(0).max(199).optional(),
  })
  .strict()
  .refine(
    (m) => new Set(Object.values(m)).size === Object.values(m).length,
    'Map each source column at most once',
  );
export async function zipLimits(bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(new HttpError(422, 'INVALID_WORKBOOK'));
      let size = 0,
        actual = 0,
        count = 0,
        failed = false;
      const fail = (status: number, code: string) => {
        if (failed) return;
        failed = true;
        zip.close();
        reject(new HttpError(status, code));
      };
      zip.on('error', () => fail(422, 'INVALID_WORKBOOK'));
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        size += entry.uncompressedSize;
        count++;
        if (
          size > 25 * 1024 * 1024 ||
          count > 500 ||
          entry.fileName.includes('..') ||
          /vbaProject/i.test(entry.fileName) ||
          (entry.generalPurposeBitFlag & 1) !== 0
        ) {
          fail(413, 'WORKBOOK_LIMIT');
        } else
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) {
              fail(422, 'INVALID_WORKBOOK');
              return;
            }
            stream.on('data', (chunk: Buffer) => {
              actual += chunk.length;
              if (actual > 25 * 1024 * 1024) {
                stream.destroy();
                fail(413, 'WORKBOOK_LIMIT');
              }
            });
            stream.on('error', () => fail(422, 'INVALID_WORKBOOK'));
            stream.on('end', () => {
              if (!failed) zip.readEntry();
            });
          });
      });
      zip.readEntry();
    });
  });
}
export async function readSheets(
  bytes: Buffer,
  format: 'csv' | 'xlsx',
): Promise<{ name: string; rows: unknown[][] }[]> {
  if (bytes.length === 0) throw new HttpError(422, 'EMPTY_FILE');
  if (format === 'csv') {
    try {
      const rows: unknown[][] = parse(bytes, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
        max_record_size: 100000,
        cast: false,
      });
      if (rows.length > MAX_ROWS + 20 || rows.some((r) => r.length > 200))
        throw new HttpError(413, 'SHEET_LIMIT');
      return [{ name: 'CSV', rows }];
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(422, 'INVALID_CSV');
    }
  }
  await zipLimits(bytes);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new HttpError(422, 'INVALID_WORKBOOK');
  }
  if (workbook.worksheets.length > 10) throw new HttpError(413, 'SHEET_LIMIT');
  return workbook.worksheets.map((sheet) => {
    if (sheet.rowCount > MAX_ROWS + 20 || sheet.columnCount > 200)
      throw new HttpError(413, 'SHEET_LIMIT');
    const rows: unknown[][] = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row: unknown[] = [];
      for (let j = 1; j <= sheet.columnCount; j++) {
        const value = sheet.getRow(i).getCell(j).value;
        row.push(value);
      }
      rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}
function text(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number')
    return String(value).trim();
  throw new Error('Formula, hyperlink or structured cells cannot be mapped');
}
function dob(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || value === 60 || value > 100000)
      throw new Error('Invalid Excel birth date');
    value = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  }
  let result = text(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(result)) {
    const [day, month, year] = result.split('/');
    result = year + '-' + month + '-' + day;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result ||
    result > new Date().toISOString().slice(0, 10) ||
    result < '1900-01-01'
  )
    throw new Error('Invalid birth date; use YYYY-MM-DD or DD/MM/YYYY');
  return result;
}
export function normalizeRows(
  rows: unknown[][],
  header: number,
  mapping: z.infer<typeof mappingSchema>,
) {
  if (!rows[header]) throw new HttpError(422, 'INVALID_HEADER');
  const seen = new Set<string>();
  return rows
    .slice(header + 1)
    .map((row, index) => {
      const errors: string[] = [];
      const player = {
        name: '',
        registrationId: null as string | null,
        dob: null as string | null,
        previousTeam: null as string | null,
        category: null as string | null,
        playerPhotoURL: null as string | null,
      };
      try {
        for (const field of fields) {
          const column = mapping[field];
          if (column === undefined) continue;
          const raw = row[column];
          if (field === 'dob') player.dob = dob(raw);
          else {
            const value = text(raw);
            if (value.length > 200)
              throw new Error('Mapped values must be at most 200 characters');
            if (field === 'name') player.name = value;
            else player[field] = value || null;
          }
        }
        if (
          !player.name &&
          row.some(
            (v) =>
              v !== null &&
              v !== undefined &&
              (typeof v !== 'string' || v.trim() !== ''),
          )
        )
          errors.push('Name is required');
        if (
          player.playerPhotoURL &&
          !/^https:\/\/\S+$/.test(player.playerPhotoURL)
        )
          errors.push('Photo must be an HTTPS URL');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Invalid row');
      }
      const key = player.registrationId
        ? 'registration:' + player.registrationId.toLowerCase()
        : 'identity:' +
          JSON.stringify([
            player.name.toLowerCase(),
            player.dob,
            player.previousTeam?.toLowerCase(),
          ]);
      const duplicate = seen.has(key);
      seen.add(key);
      return { row: index + header + 2, player, key, errors, duplicate };
    })
    .filter((row) => row.player.name || row.errors.length);
}
