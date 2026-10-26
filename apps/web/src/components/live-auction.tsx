'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LiveState } from '@/lib/live-types';
import { mutate } from '@/lib/client-api';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { useAuctionEvents } from '@/lib/use-auction-events';
interface Decision {
  lotId: string;
  version: number;
  decision: 'SOLD' | 'UNSOLD';
  requestId: string;
  name: string;
}
export function LiveAuction({
  id,
  initial,
}: {
  id: string;
  initial: LiveState;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [syncError, setSyncError] = useState(''),
    [modal, setModal] = useState<Decision | null>(null),
    [amount, setAmount] = useState(
      Math.max(initial.auction.minimumPrice ?? 0, 1),
    ),
    [team, setTeam] = useState(''),
    [rotation, setRotation] = useState(0),
    [revealing, setRevealing] = useState(false),
    [outcome, setOutcome] = useState(''),
    [correcting, setCorrecting] = useState(false),
    [reason, setReason] = useState('');
  const auto = useRef(false);
  const [retry, setRetry] = useState<Record<string, unknown> | null>(null);
  const base = '/auctions/' + id;
  const adopt = useCallback((next: LiveState) => {
    setData((current) =>
      (next.engine?.version ?? -1) > (current.engine?.version ?? -1) ||
      (!next.engine && next.auction.version > current.auction.version)
        ? next
        : current,
    );
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api' + base + '/live', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      adopt(await response.json());
      setSyncError('');
    } catch {
      setSyncError(
        'Connection interrupted. Decisions remain saved on the server. Retry or wait for reconnection.',
      );
    }
  }, [adopt, base]);
  const connected = useAuctionEvents(id, initial.auction.version, refresh);
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [connected, refresh]);
  async function act(action: string, payload: unknown) {
    setBusy(true);
    setError('');
    try {
      const next: LiveState = await mutate(
        base + '/live/' + action,
        'POST',
        payload,
      );
      adopt(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }
  const spin = useCallback(async () => {
    if (!data.engine) return;
    setBusy(true);
    setError('');
    setOutcome('');
    auto.current = false;
    try {
      const next: LiveState = await mutate(base + '/live/spin', 'POST', {
        version: data.engine.version,
      });
      adopt(next);
      if (next.current) {
        setRevealing(true);
        const target = 360 - ((next.current.selectionIndex % 8) * 45 + 22.5);
        setRotation((value) => Math.ceil(value / 360) * 360 + 1440 + target);
        setTimeout(() => setRevealing(false), 1800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Selection failed');
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [data.engine, base, adopt, refresh]);
  useEffect(() => {
    const engine = data.engine;
    if (
      !auto.current ||
      !engine ||
      !engine.autoNext ||
      engine.paused ||
      engine.completed ||
      engine.pendingId ||
      !engine.queue.length ||
      busy
    )
      return;
    const timer = setTimeout(() => void spin(), engine.delayMs);
    return () => clearTimeout(timer);
  }, [data.engine, busy, spin]);
  const engine = data.engine,
    current = data.current,
    canDecide = !!current && !busy && !revealing;
  function confirm(decision: 'SOLD' | 'UNSOLD') {
    if (!current || !engine) return;
    setRetry(null);
    setAmount(Math.max(data.auction.minimumPrice ?? 0, 1));
    setTeam('');
    setModal({
      lotId: current._id,
      version: engine.version,
      decision,
      requestId: crypto.randomUUID(),
      name: current.player?.name ?? 'Player',
    });
  }
  return (
    <main className="py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {data.auction.name} / {data.auction.denomination}
          </p>
          <h1 className="page-heading mt-3">Live Auction</h1>
          <p className="mt-2 text-xs text-slate-400">
            {connected
              ? 'Live connection active'
              : 'Checking for updates; REST recovery active'}
          </p>
        </div>
        <div role="status" className="text-sm text-slate-300">
          {engine
            ? engine.completed
              ? 'Completed'
              : engine.paused
                ? 'Paused'
                : 'Round ' +
                  engine.round +
                  ' / ' +
                  engine.queue.length +
                  ' remaining'
            : 'Ready for setup'}
        </div>
      </div>
      {(error || syncError) && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-300/40 p-4 text-red-200"
        >
          {error || syncError}{' '}
          <button className="underline" onClick={() => void refresh()}>
            Reload saved state
          </button>
        </div>
      )}
      <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <section className="panel p-5 text-center sm:p-9">
          <div
            className="relative mx-auto h-48 w-48 sm:h-64 sm:w-64"
            aria-hidden="true"
          >
            <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-3xl text-amber-200">
              ▼
            </div>
            <div
              className="h-full w-full rounded-full border-8 border-slate-700 shadow-xl"
              style={{
                background:
                  'conic-gradient(#fcd34d 0deg 45deg,#334155 45deg 90deg,#38bdf8 90deg 135deg,#1e293b 135deg 180deg,#f59e0b 180deg 225deg,#475569 225deg 270deg,#34d399 270deg 315deg,#0f172a 315deg 360deg)',
                transform: 'rotate(' + rotation + 'deg)',
                transition: 'transform 1.8s cubic-bezier(.12,.7,.15,1)',
              }}
            />
            <div className="absolute inset-[36%] flex items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-amber-200">
              AUCTION
            </div>
          </div>
          <div aria-live="polite" className="mt-8 min-h-28">
            {revealing ? (
              <p className="text-xl text-amber-200">
                Revealing server selection...
              </p>
            ) : current?.player ? (
              <>
                <p className="text-xs tracking-widest text-amber-300">
                  SELECTED PLAYER
                </p>
                {current.player.playerPhotoURL ? (
                  // Private images and optional external photos use the browser directly.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.player.playerPhotoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="mx-auto mt-4 h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-700 text-3xl text-amber-200"
                  >
                    {current.player.name.slice(0, 1)}
                  </div>
                )}
                <h2 className="mt-3 break-words text-4xl font-bold">
                  {current.player.name}
                </h2>
                <p className="mt-3 text-slate-400">
                  {[
                    current.player.registrationId,
                    current.player.category,
                    current.player.previousTeam,
                    current.player.dob,
                  ]
                    .filter(Boolean)
                    .join(' / ') || 'Player details not provided'}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold">
                  {!engine
                    ? 'Prepare to begin'
                    : engine.completed
                      ? 'Auction completed'
                      : !engine.queue.length
                        ? 'Round finished'
                        : 'Ready for the next player'}
                </h2>
                <p className="mt-3 text-slate-400">
                  {engine?.pendingId
                    ? 'Reload to recover the selection.'
                    : 'Every selection and decision is saved on the server.'}
                </p>
              </>
            )}
          </div>
          {outcome && (
            <p
              role="status"
              className="mb-5 rounded-lg bg-emerald-400/10 p-4 text-emerald-200"
            >
              {outcome}
            </p>
          )}
          {!engine ? (
            <Button disabled={busy} onClick={() => void act('start', {})}>
              Start auction
            </Button>
          ) : !engine.completed ? (
            <div className="flex flex-wrap justify-center gap-4">
              {current ? (
                <>
                  <Button disabled={!canDecide} onClick={() => confirm('SOLD')}>
                    Mark SOLD
                  </Button>
                  <Button
                    className="bg-slate-200 hover:bg-white"
                    disabled={!canDecide}
                    onClick={() => confirm('UNSOLD')}
                  >
                    Mark UNSOLD
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || engine.paused || !engine.queue.length}
                  onClick={() => void spin()}
                >
                  Spin next player
                </Button>
              )}
              <Button
                className="bg-slate-700 text-white hover:bg-slate-600"
                disabled={busy}
                onClick={async () => {
                  auto.current = engine.paused;
                  await act(engine.paused ? 'resume' : 'pause', {
                    version: engine.version,
                  });
                }}
              >
                {engine.paused ? 'Resume auction' : 'Pause auction'}
              </Button>
            </div>
          ) : (
            <Link href={base + '/results'} className="action inline-block">
              View results
            </Link>
          )}
          {engine && !engine.completed && (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={engine.autoNext}
                  disabled={busy}
                  onChange={() =>
                    void act('settings', {
                      version: engine.version,
                      autoNext: !engine.autoNext,
                      delayMs: engine.delayMs,
                    })
                  }
                />
                Automatically spin after confirmation
              </label>
              <label>
                Delay
                <select
                  className="ml-2 rounded bg-slate-800 p-2"
                  value={engine.delayMs}
                  disabled={busy}
                  onChange={(e) =>
                    void act('settings', {
                      version: engine.version,
                      autoNext: engine.autoNext,
                      delayMs: Number(e.target.value),
                    })
                  }
                >
                  {[500, 1500, 3000, 5000, 10000].map((ms) => (
                    <option key={ms} value={ms}>
                      {ms / 1000} seconds
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {engine &&
            !engine.pendingId &&
            !engine.queue.length &&
            !engine.completed && (
              <Link
                href={base + '/unsold'}
                className="mt-7 inline-block text-amber-300 underline"
              >
                Review round and unsold players
              </Link>
            )}
        </section>
        <aside aria-label="Team budgets" className="space-y-4">
          {data.teams.map((team) => (
            <article key={team._id} className="stat-card">
              <h2 className="text-xl font-semibold">{team.name}</h2>
              <div className="mt-4 flex justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Remaining</p>
                  <p className="mt-1 text-xl text-amber-200">
                    {team.remaining.toLocaleString('en-IN')}{' '}
                    {data.auction.denomination}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Slots used</p>
                  <p className="mt-1 text-xl">
                    {team.usedSlots}/{team.maxSlots}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {!data.teams.length && (
            <p className="text-slate-400">
              Add at least one team before starting.
            </p>
          )}
        </aside>
      </div>
      {engine && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Recent decisions</h2>
            <Button
              className="bg-slate-700 text-white hover:bg-slate-600"
              disabled={
                busy ||
                !engine.paused ||
                !!engine.pendingId ||
                !data.history.some((l) => l.status !== 'VOID')
              }
              onClick={() => {
                setCorrecting(true);
                setReason('');
              }}
            >
              Undo last decision
            </Button>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Undo requires a paused auction with no pending selection and an
            audit reason.
          </p>
          <ul className="mt-5 space-y-2">
            {data.history.map((lot) => (
              <li
                className="flex justify-between gap-3 rounded-lg bg-slate-900 p-4 text-sm"
                key={lot._id}
              >
                <span>
                  Round {lot.round} /{' '}
                  {lot.playerName ?? lot.playerId.slice(0, 8)}
                </span>
                <span
                  className={
                    lot.status === 'SOLD'
                      ? 'text-emerald-300'
                      : 'text-amber-200'
                  }
                >
                  {lot.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {modal && modal.lotId === current?._id && (
        <Dialog
          title={'Confirm ' + modal.decision + ' / ' + modal.name}
          onClose={() => setModal(null)}
        >
          <form
            className="mt-6 space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const payload = retry ?? {
                version: modal.version,
                lotId: modal.lotId,
                requestId: modal.requestId,
                decision: modal.decision,
                ...(modal.decision === 'SOLD' ? { amount, teamId: team } : {}),
              };
              setRetry(payload);
              const next = await act('decision', payload);
              if (next) {
                auto.current = true;
                setModal(null);
                setRetry(null);
                setOutcome(
                  modal.name +
                    ' marked ' +
                    modal.decision +
                    (modal.decision === 'SOLD'
                      ? ' at ' +
                        amount.toLocaleString('en-IN') +
                        ' ' +
                        data.auction.denomination
                      : '. Budgets unchanged.'),
                );
              }
            }}
          >
            {modal.decision === 'SOLD' ? (
              <>
                <label className="block">
                  Final amount ({data.auction.denomination})
                  <input
                    autoFocus
                    className="field mt-2"
                    type="number"
                    required
                    min={Math.max(data.auction.minimumPrice ?? 0, 1)}
                    max={Number.MAX_SAFE_INTEGER}
                    step={1}
                    value={amount}
                    disabled={busy || retry !== null}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  Purchasing team
                  <select
                    className="field mt-2"
                    required
                    value={team}
                    disabled={busy || retry !== null}
                    onChange={(e) => setTeam(e.target.value)}
                  >
                    <option value="">Choose an eligible team</option>
                    {data.teams.map((t) => (
                      <option
                        value={t._id}
                        key={t._id}
                        disabled={t.remaining < amount || t.remainingSlots < 1}
                      >
                        {t.name} / {t.remaining.toLocaleString('en-IN')}{' '}
                        remaining / {t.remainingSlots} slots
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="text-slate-300">
                This player will be marked UNSOLD. No team budget will change.
              </p>
            )}
            {error && (
              <p role="alert" className="text-red-200">
                {error}
              </p>
            )}
            <div className="flex gap-5">
              <Button disabled={busy}>
                {busy
                  ? 'Saving...'
                  : retry
                    ? 'Retry same decision'
                    : 'Confirm ' + modal.decision}
              </Button>
              <button type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {correcting && engine && (
        <Dialog
          title="Undo the last decision"
          onClose={() => setCorrecting(false)}
        >
          <form
            className="mt-6 space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const lot = data.history.find((l) => l.status !== 'VOID');
              if (!lot) return;
              const next = await act('correct', {
                version: engine.version,
                lotId: lot._id,
                requestId: crypto.randomUUID(),
                reason,
              });
              if (next) {
                setCorrecting(false);
                auto.current = false;
                setOutcome(
                  'Decision voided. The player is queued again and the ledger is reconciled.',
                );
              }
            }}
          >
            <label className="block">
              Correction reason
              <textarea
                autoFocus
                className="field mt-2"
                required
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="flex gap-5">
              <Button disabled={busy}>Confirm audited undo</Button>
              <button type="button" onClick={() => setCorrecting(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
