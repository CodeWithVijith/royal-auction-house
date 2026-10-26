import Link from 'next/link';
import type { Auction } from '@sports/shared';
import { serverApi } from '@/lib/api';
export default async function Dashboard() {
  const { auctions } = await serverApi<{ auctions: Auction[] }>('/auctions');
  return (
    <main className="py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">YOUR ORGANIZER WORKSPACE</p>
          <h1 className="page-heading mt-3">My Auctions</h1>
          <p className="mt-3 text-slate-400">
            Prepare the next season. Build the next great team.
          </p>
        </div>
        <Link href="/auctions/new" className="action">
          Create auction
        </Link>
      </div>
      {auctions.length === 0 ? (
        <section className="empty-state mt-10">
          <p className="text-4xl text-amber-300" aria-hidden="true">
            +
          </p>
          <h2 className="mt-5 text-xl font-semibold">
            Your first auction starts here
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-400">
            Choose a sport, set your team defaults, and create your own
            organizer workspace.
          </p>
          <Link
            href="/auctions/new"
            className="mt-7 inline-block text-amber-300 underline"
          >
            Create your first auction
          </Link>
        </section>
      ) : (
        <>
          <p className="mt-9 text-sm text-slate-400">
            Your latest auctions ({auctions.length}, up to 100).
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => (
              <Link
                key={auction.id}
                href={'/auctions/' + auction.id + '/overview'}
                className="stat-card group"
              >
                <div className="flex justify-between gap-3">
                  <p className="text-sm text-slate-400">{auction.sport}</p>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-amber-200">
                    {auction.status}
                  </span>
                </div>
                <h2 className="mt-6 break-words text-xl font-bold transition group-hover:text-amber-300">
                  {auction.name}
                </h2>
                <p className="mt-5 text-sm text-slate-400">
                  {auction.defaultBudget.toLocaleString('en-IN')}{' '}
                  {auction.denomination} / team / {auction.defaultSlots} slots
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
