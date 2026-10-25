import Link from 'next/link';
import type { Auction } from '@sports/shared';
import { serverApi } from '@/lib/api';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { auction } = await serverApi<{ auction: Auction }>(
    '/auctions/' + encodeURIComponent(id),
  );
  return (
    <main className="py-12">
      <Link href="/dashboard" className="text-sm text-amber-300 underline">
        Back to my auctions
      </Link>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs tracking-widest text-amber-300">
            {auction.status} / {auction.sport}
          </p>
          <h1 className="mt-3 break-words text-4xl font-semibold">
            {auction.name}
          </h1>
        </div>
        {auction.status === 'DRAFT' && (
          <Link
            href={'/auctions/' + auction.id + '/settings'}
            className="action"
          >
            Edit settings
          </Link>
        )}
      </div>
      <dl className="mt-10 grid gap-5 sm:grid-cols-3">
        {[
          [
            'Default budget',
            auction.defaultBudget.toLocaleString('en-IN') +
              ' ' +
              auction.denomination,
          ],
          ['Roster slots', auction.defaultSlots],
          [
            'Minimum price',
            auction.minimumPrice === null
              ? 'No minimum'
              : auction.minimumPrice.toLocaleString('en-IN') +
                ' ' +
                auction.denomination,
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-700 bg-slate-900 p-6"
          >
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd className="mt-3 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-10 rounded-xl border border-slate-700 p-6">
        <h2 className="text-xl font-semibold">Auction workspace created</h2>
        <p className="mt-3 max-w-2xl text-slate-400">
          Your auction settings are saved. Review the budget, roster size, and
          denomination before preparing your player list.
        </p>
      </section>
    </main>
  );
}
