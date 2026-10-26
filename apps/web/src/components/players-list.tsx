'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client-api';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
interface Player {
  _id: string;
  name: string;
  registrationId: string | null;
  dob: string | null;
  previousTeam: string | null;
  category: string | null;
  status: string;
}
export function PlayersList({
  id,
  players,
  locked,
}: {
  id: string;
  players: Player[];
  locked: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(''),
    [editing, setEditing] = useState<Player | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="mt-8">
      <label className="block max-w-lg">
        Search players
        <input
          className="field mt-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {players.length === 0 && (
        <div className="empty-state mt-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-2xl text-amber-400">
            P
          </div>
          <h2 className="mt-4 text-xl font-bold">No Players Yet</h2>
          <p className="mt-2 text-slate-400">
            Import your registration sheet to prepare the auction roster.
          </p>
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players
          .filter((p) =>
            [p.name, p.registrationId, p.category].some((v) =>
              v?.toLowerCase().includes(search.toLowerCase()),
            ),
          )
          .map((player) => (
            <article key={player._id} className="stat-card">
              <span className="text-xs text-amber-300">{player.status}</span>
              <h2 className="mt-3 text-xl font-semibold">{player.name}</h2>
              <dl className="mt-4 space-y-2 text-sm text-slate-400">
                <div>
                  <dt className="inline">Registration: </dt>
                  <dd className="inline">{player.registrationId ?? '-'}</dd>
                </div>
                <div>
                  <dt className="inline">DOB: </dt>
                  <dd className="inline">{player.dob ?? '-'}</dd>
                </div>
                <div>
                  <dt className="inline">Category: </dt>
                  <dd className="inline">{player.category ?? '-'}</dd>
                </div>
                <div>
                  <dt className="inline">Previous team: </dt>
                  <dd className="inline">{player.previousTeam ?? '-'}</dd>
                </div>
              </dl>
              {!locked && (
                <button
                  className="mt-4 min-h-11 text-sm text-amber-300 underline"
                  onClick={() => {
                    setEditing(player);
                    setError('');
                  }}
                >
                  Edit {player.name}
                </button>
              )}
            </article>
          ))}
      </div>
      {editing && (
        <Dialog title="Edit player" onClose={() => setEditing(null)}>
          <form
            className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await mutate(
                  '/auctions/' + id + '/players/' + editing._id,
                  'PATCH',
                  {
                    name: editing.name,
                    previousTeam: editing.previousTeam,
                    category: editing.category,
                  },
                );
                setEditing(null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Save failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {(['name', 'previousTeam', 'category'] as const).map((field) => (
              <label key={field} className="mt-4 block">
                {field}
                <input
                  autoFocus={field === 'name'}
                  required={field === 'name'}
                  maxLength={200}
                  className="field mt-2"
                  value={editing[field] ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, [field]: e.target.value || null })
                  }
                />
              </label>
            ))}
            {error && <p role="alert">{error}</p>}
            <div className="mt-5 flex gap-5">
              <Button disabled={busy}>Save player</Button>
              <button
                type="button"
                className="text-amber-300"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
