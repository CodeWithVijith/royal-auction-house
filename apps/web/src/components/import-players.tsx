'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { mutate } from '@/lib/client-api';
const fields = [
  'name',
  'registrationId',
  'dob',
  'previousTeam',
  'category',
  'playerPhotoURL',
] as const;
const subscribe = () => () => undefined;
interface Upload {
  uploadId: string;
  sheets: { name: string; headers: string[][] }[];
  savedMapping: {
    mapping: Record<string, number>;
    sheet: number;
    header: number;
  } | null;
}
interface Preview {
  rows: {
    row: number;
    player: { name: string; dob: string | null };
    errors: string[];
    existing: boolean;
    duplicate: boolean;
  }[];
  valid: number;
  invalid: number;
}
export function ImportPlayers({ id }: { id: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [upload, setUpload] = useState<Upload | null>(null),
    [sheet, setSheet] = useState(0),
    [header, setHeader] = useState(0),
    [mapping, setMapping] = useState<Record<string, number>>({}),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const base = '/auctions/' + id;
  const input = { uploadId: upload?.uploadId, sheet, header, mapping };
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-6">
      <p className="max-w-3xl text-slate-400">
        Upload CSV or XLSX (5 MB, 5,000 players, 200 columns). Only mapped
        fields are saved to players. Contact and address columns stay unmapped.
        Temporary uploads expire after 30 minutes.
      </p>
      <label className="block">
        Spreadsheet
        <input
          className="field mt-2"
          type="file"
          accept=".csv,.xlsx"
          disabled={busy || !hydrated}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPreview(null);
            void run(async () => {
              if (file.size > 5 * 1024 * 1024)
                throw new Error('Choose a file under 5 MB');
              const format = file.name.toLowerCase().endsWith('.xlsx')
                ? 'xlsx'
                : 'csv';
              const response = await fetch(
                '/api' + base + '/imports/upload?format=' + format,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/octet-stream' },
                  body: file,
                },
              );
              if (!response.ok)
                throw new Error(
                  'Upload rejected. Check the file format and limits.',
                );
              const data: Upload = await response.json();
              setUpload(data);
              setSheet(data.savedMapping?.sheet ?? 0);
              setHeader(data.savedMapping?.header ?? 0);
              setMapping(data.savedMapping?.mapping ?? {});
            });
          }}
        />
      </label>
      {upload && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              Worksheet
              <select
                className="field mt-2"
                value={sheet}
                onChange={(e) => {
                  setSheet(Number(e.target.value));
                  setPreview(null);
                  setMapping({});
                }}
              >
                {upload.sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Header row
              <select
                className="field mt-2"
                value={header}
                onChange={(e) => {
                  setHeader(Number(e.target.value));
                  setPreview(null);
                }}
              >
                {upload.sheets[sheet]?.headers.map((_, i) => (
                  <option key={i} value={i}>
                    Row {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <label key={field}>
                {field}
                {field === 'name' ? ' (required)' : ''}
                <select
                  aria-label={field === 'name' ? 'name (required)' : field}
                  className="field mt-2"
                  value={mapping[field] ?? ''}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === '') delete next[field];
                    else next[field] = Number(e.target.value);
                    setMapping(next);
                    setPreview(null);
                  }}
                >
                  <option value="">Do not import</option>
                  {upload.sheets[sheet]?.headers[header]?.map((title, i) => (
                    <option key={i} value={i}>
                      {i + 1}: {title || 'Untitled'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Button
            disabled={busy || mapping.name === undefined}
            onClick={() =>
              void run(async () =>
                setPreview(
                  await mutate(base + '/imports/preview', 'POST', input),
                ),
              )
            }
          >
            {busy ? 'Please wait...' : 'Preview mapping'}
          </Button>
        </>
      )}
      {preview && (
        <>
          <p role="status">
            {preview.valid} valid / {preview.invalid} invalid.{' '}
            {preview.rows.filter((r) => r.existing || r.duplicate).length}{' '}
            duplicates will be skipped.
          </p>
          <div className="max-h-96 overflow-auto rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Row</th>
                  <th>Name</th>
                  <th>Date of birth</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} className="border-t border-slate-800">
                    <td className="p-3">{row.row}</td>
                    <td>{row.player.name || 'Missing'}</td>
                    <td>{row.player.dob ?? '-'}</td>
                    <td
                      className={
                        row.errors.length ? 'text-red-200' : 'text-slate-400'
                      }
                    >
                      {row.errors.join('; ') ||
                        (row.existing || row.duplicate
                          ? 'Duplicate - skip'
                          : 'Ready')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={busy || preview.invalid > 0}
            onClick={() =>
              void run(async () => {
                const result = await mutate(
                  base + '/imports/commit',
                  'POST',
                  input,
                );
                setMessage(
                  result.inserted +
                    ' players imported; ' +
                    result.skipped +
                    ' skipped.',
                );
                setPreview(null);
              })
            }
          >
            Confirm import
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-emerald-300">
          {message}{' '}
          <Link className="underline" href={base + '/players'}>
            View players
          </Link>
        </p>
      )}
    </section>
  );
}
