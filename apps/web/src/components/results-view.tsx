'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client-api';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
interface Player {
  _id: string;
  name: string;
  registrationId: string | null;
  status: string;
  category: string | null;
}
export interface Results {
  auction: {
    id: string;
    name: string;
    denomination: string;
    status: string;
    label: string;
  };
  engine: {
    version: number;
    queue: string[];
    pendingId: string | null;
    completed: boolean;
    round: number;
  } | null;
  summary: {
    players: number;
    sold: number;
    unsold: number;
    available: number;
    pending: number;
    spent: number;
  };
  players: Player[];
  teams: {
    _id: string;
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    usedSlots: number;
    maxSlots: number;
  }[];
  transactions: {
    _id: string;
    playerId: string;
    teamId: string;
    amount: number;
    void: boolean;
    at: string;
  }[];
  attempts: { _id: string; playerId: string; round: number; status: string }[];
}
export function ResultsView({
  id,
  data,
  unsoldOnly = false,
}: {
  id: string;
  data: Results;
  unsoldOnly?: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<'complete' | 'rounds/unsold' | null>(null);
  const base = '/auctions/' + id;
  const ready =
    data.engine &&
    !data.engine.pendingId &&
    !data.engine.queue.length &&
    !data.engine.completed;
  const names = new Map(data.players.map((p) => [p._id, p.name]));
  return (
    <main className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs tracking-widest text-amber-300">
            {data.auction.label} / {data.auction.denomination}
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {unsoldOnly ? 'Round review' : 'Auction results'}
          </h1>
          <p className="mt-3 text-slate-400">{data.auction.name}</p>
        </div>
        <a href={'/api' + base + '/export'} className="action" download>
          Download {data.auction.label === 'FINAL' ? 'final' : 'draft'} Excel
        </a>
      </div>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Players', data.summary.players],
          ['Sold', data.summary.sold],
          ['Unsold', data.summary.unsold],
          [
            'Spent',
            data.summary.spent.toLocaleString('en-IN') +
              ' ' +
              data.auction.denomination,
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-700 bg-slate-900 p-5"
          >
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {ready && (
        <section className="mt-8 rounded-xl border border-amber-300/40 p-6">
          <h2 className="text-2xl font-semibold">
            Round {data.engine?.round} finished
          </h2>
          <p className="mt-3 text-slate-400">
            Begin an explicit round containing only final UNSOLD players, or
            freeze this auction as complete.
          </p>
          <div className="mt-5 flex flex-wrap gap-5">
            <Button
              disabled={busy || data.summary.unsold === 0}
              onClick={() => setConfirm('rounds/unsold')}
            >
              Begin unsold round
            </Button>
            <Button
              className="bg-slate-200 hover:bg-white"
              disabled={busy}
              onClick={() => setConfirm('complete')}
            >
              Complete auction
            </Button>
          </div>
        </section>
      )}
      {data.engine && !ready && !data.engine.completed && (
        <p className="mt-6 text-slate-400">
          Resolve the pending player and remaining queue before starting another
          round or completing.{' '}
          <Link className="text-amber-300 underline" href={base + '/live'}>
            Return to live auction
          </Link>
        </p>
      )}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">
          {unsoldOnly ? 'Unsold players' : 'All players'}
        </h2>
        <div className="mt-5 overflow-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[38rem] text-left text-sm [&_td]:px-4 [&_th]:px-4">
            <thead>
              <tr>
                <th className="p-4">Player</th>
                <th>Registration</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.players
                .filter((p) => !unsoldOnly || p.status === 'UNSOLD')
                .map((p) => (
                  <tr key={p._id} className="border-t border-slate-800">
                    <td className="p-4 font-semibold">{p.name}</td>
                    <td>{p.registrationId ?? '-'}</td>
                    <td>{p.status}</td>
                    <td>
                      {data.attempts
                        .filter((a) => a.playerId === p._id)
                        .map((a) => 'R' + a.round + ': ' + a.status)
                        .join(' / ') || 'Not selected'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {data.players.length === 0 && (
          <p className="mt-5 text-slate-400">No players imported yet.</p>
        )}
      </section>
      {!unsoldOnly && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Team rosters</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {data.teams.map((team) => (
              <article
                key={team._id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-6"
              >
                <h3 className="text-xl font-semibold">{team.name}</h3>
                <p className="mt-3 text-sm text-amber-200">
                  {team.spent.toLocaleString('en-IN')} spent /{' '}
                  {team.remaining.toLocaleString('en-IN')} remaining (
                  {data.auction.denomination})
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {team.usedSlots}/{team.maxSlots} slots used
                </p>
                <ul className="mt-5 space-y-3">
                  {data.transactions
                    .filter((t) => t.teamId === team._id && !t.void)
                    .map((t) => (
                      <li
                        key={t._id}
                        className="flex justify-between gap-3 border-t border-slate-700 pt-3"
                      >
                        <span>{names.get(t.playerId)}</span>
                        <span>
                          {t.amount.toLocaleString('en-IN')}{' '}
                          {data.auction.denomination}
                        </span>
                      </li>
                    ))}
                </ul>
                {team.usedSlots === 0 && (
                  <p className="mt-4 text-slate-400">No purchases.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {confirm && (
        <Dialog
          title={
            confirm === 'complete'
              ? 'Complete this auction?'
              : 'Begin an unsold round?'
          }
          onClose={() => setConfirm(null)}
        >
          <p className="mt-5 text-slate-300">
            {confirm === 'complete'
              ? 'Results will be frozen. Any later correction requires an explicit audited undo.'
              : 'Only players currently marked UNSOLD will be queued. All earlier round history stays intact.'}
          </p>
          {error && (
            <p role="alert" className="mt-4 text-red-200">
              {error}
            </p>
          )}
          <div className="mt-6 flex gap-5">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await mutate(base + '/' + confirm, 'POST', {
                    version: data.engine?.version,
                  });
                  setConfirm(null);
                  if (confirm === 'rounds/unsold') router.push(base + '/live');
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Action failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving...' : 'Confirm'}
            </Button>
            <button onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
