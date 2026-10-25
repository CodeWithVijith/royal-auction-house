'use client';
/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client-api';
import { Button } from './ui/button';
export interface Team {
  _id: string;
  name: string;
  budget: number;
  maxSlots: number;
  logoUrl: string | null;
  spent: number;
  remaining: number;
  usedSlots: number;
  remainingSlots: number;
  purchases: { playerId: string; amount: number }[];
}
export function TeamManager({
  id,
  teams,
  denomination,
  locked,
  defaultBudget,
  defaultSlots,
}: {
  id: string;
  teams: Team[];
  denomination: string;
  locked: boolean;
  defaultBudget: number;
  defaultSlots: number;
}) {
  const router = useRouter(),
    [editing, setEditing] = useState<Team | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [logo, setLogo] = useState<string | null>(null),
    [deleting, setDeleting] = useState<Team | null>(null);
  const base = '/auctions/' + id;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await mutate(
        base + '/teams' + (editing ? '/' + editing._id : ''),
        editing ? 'PATCH' : 'POST',
        {
          name: data.get('name'),
          budget: Number(data.get('budget')),
          maxSlots: Number(data.get('maxSlots')),
          logoUrl: logo,
        },
      );
      setMessage(editing ? 'Team updated.' : 'Team created.');
      setEditing(null);
      setLogo(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Team could not be saved');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <article
            key={team._id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-6"
          >
            {team.logoUrl && (
              <img
                className="mb-4 h-16 w-16 rounded-lg object-contain"
                src={team.logoUrl}
                alt={team.name + ' logo'}
              />
            )}
            <h2 className="text-xl font-semibold">{team.name}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-400">Remaining</dt>
                <dd className="mt-1 text-lg text-amber-200">
                  {team.remaining.toLocaleString('en-IN')} {denomination}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Slots used</dt>
                <dd className="mt-1 text-lg">
                  {team.usedSlots} / {team.maxSlots}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Spent</dt>
                <dd>
                  {team.spent.toLocaleString('en-IN')} {denomination}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Starting budget</dt>
                <dd>
                  {team.budget.toLocaleString('en-IN')} {denomination}
                </dd>
              </div>
            </dl>
            {!locked && (
              <div className="mt-5 flex gap-5">
                <button
                  className="min-h-11 text-amber-300 underline"
                  onClick={() => {
                    setEditing(team);
                    setLogo(team.logoUrl);
                    setError('');
                  }}
                >
                  Edit {team.name}
                </button>
                <button
                  className="min-h-11 text-red-200 underline"
                  onClick={() => setDeleting(team)}
                >
                  Delete {team.name}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!teams.length && (
        <p className="text-slate-400">
          No teams yet. Add the clubs taking part in this auction.
        </p>
      )}
      {!locked && (
        <form
          key={editing?._id ?? 'new'}
          onSubmit={submit}
          className="mt-10 max-w-2xl space-y-5 rounded-xl border border-slate-700 p-6"
        >
          <h2 className="text-2xl font-semibold">
            {editing ? 'Edit team' : 'Add team'}
          </h2>
          <label className="block">
            Team name
            <input
              className="field mt-2"
              name="name"
              minLength={2}
              maxLength={100}
              required
              defaultValue={editing?.name ?? ''}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              Budget ({denomination})
              <input
                className="field mt-2"
                type="number"
                name="budget"
                step={1}
                min={0}
                max={Number.MAX_SAFE_INTEGER}
                required
                defaultValue={editing?.budget ?? defaultBudget}
              />
            </label>
            <label>
              Roster slots
              <input
                className="field mt-2"
                type="number"
                name="maxSlots"
                step={1}
                min={1}
                max={1000}
                required
                defaultValue={editing?.maxSlots ?? defaultSlots}
              />
            </label>
          </div>
          <label className="block">
            Team logo (PNG, JPEG or WebP; 2 MB)
            <input
              className="field mt-2"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError('');
                setBusy(true);
                try {
                  if (file.size > 2 * 1024 * 1024)
                    throw new Error('Logo must be under 2 MB');
                  const response = await fetch('/api' + base + '/assets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: file,
                  });
                  if (!response.ok)
                    throw new Error(
                      'Logo rejected. Use a PNG, JPEG or WebP under 4 megapixels.',
                    );
                  setLogo((await response.json()).url);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Upload failed');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {logo && (
            <div className="flex items-center gap-4">
              <img
                src={logo}
                alt="Uploaded team logo"
                className="h-16 w-16 object-contain"
              />
              <button
                type="button"
                className="text-amber-200 underline"
                onClick={() => setLogo(null)}
              >
                Remove logo
              </button>
            </div>
          )}
          <div className="flex gap-5">
            <Button disabled={busy}>
              {busy ? 'Saving...' : editing ? 'Save team' : 'Create team'}
            </Button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setLogo(null);
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}
      {deleting && (
        <section
          role="alertdialog"
          aria-labelledby="delete-team-title"
          className="mt-8 rounded-xl border border-red-300 p-6"
        >
          <h2 id="delete-team-title" className="text-xl">
            Delete {deleting.name}?
          </h2>
          <p className="mt-3 text-slate-400">
            This removes the draft team and records an audit entry.
          </p>
          <div className="mt-5 flex gap-5">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate(base + '/teams/' + deleting._id, 'DELETE');
                  setDeleting(null);
                  setMessage('Team deleted.');
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Delete failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm delete
            </Button>
            <button onClick={() => setDeleting(null)}>Cancel</button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="mt-5 text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-5 text-emerald-300">
          {message}
        </p>
      )}
      {locked && (
        <p className="mt-8 text-slate-400">
          Team settings are locked after the auction starts. Purchases and
          totals are calculated from the server ledger.
        </p>
      )}
    </section>
  );
}
