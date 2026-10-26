import Link from 'next/link';
export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <header className="flex items-center justify-between border-b border-slate-700 pb-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          SPORTS<span className="text-amber-300"> / </span>AUCTION
        </Link>
        <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">
          Organizer workspace
        </span>
      </header>
      <section className="grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr] lg:py-24">
        <div>
          <p className="mb-5 text-xs font-bold tracking-[0.22em] text-amber-300">
            EVERY PLAYER. A FAIR CHANCE.
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Great teams start with a great auction.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
            One place to prepare your players, organize your teams, and run the
            big day with confidence.
          </p>
          <div className="mt-10 border-l-2 border-amber-300 pl-5">
            <p className="font-semibold">
              From registration sheet to final roster
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Import players, brand your teams, run the live auction and export
              a reconciled workbook. Each auction keeps its own budgets and
              results.
            </p>
          </div>
          <div className="mt-7 flex gap-5">
            <Link href="/register" className="action">
              Create account
            </Link>
            <Link
              href="/login"
              className="min-h-11 px-3 py-3 text-amber-300 underline"
            >
              Sign in
            </Link>
          </div>
        </div>
        <aside
          aria-labelledby="status-heading"
          className="self-center rounded-2xl border border-slate-700 bg-slate-900 p-8"
        >
          <p className="text-xs tracking-widest text-slate-400">
            PLATFORM STATUS
          </p>
          <h2 id="status-heading" className="mt-4 text-2xl font-semibold">
            Ready for auction day
          </h2>
          <div
            role="status"
            className="my-6 flex items-center gap-3 border-y border-slate-700 py-5"
          >
            <span
              aria-hidden="true"
              className={'h-2 w-2 rounded-full bg-emerald-400'}
            />
            <span className="text-sm">
              Import, auction and export in one workspace
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Open your organizer workspace to manage teams, import registered
            players, run the live room, and export final results.
          </p>
          <Link href="/login" className="action mt-6">
            Open workspace
          </Link>
        </aside>
      </section>
      <section
        aria-label="Auction workflow"
        className="grid gap-6 border-t border-slate-700 pt-8 sm:grid-cols-3"
      >
        {[
          [
            '01',
            'Prepare your roster',
            'Import only the player details your auction needs.',
          ],
          [
            '02',
            'Build the competition',
            'Set team budgets, identities, and roster limits.',
          ],
          ['03', 'Run the room', 'Make every selection and decision count.'],
        ].map(([number, title, description]) => (
          <article key={number}>
            <p className="text-xs text-amber-300">{number}</p>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {description}
            </p>
          </article>
        ))}
      </section>
      <footer className="mt-16 pb-4 text-xs text-slate-500">
        Sports Auction / Organizer workspace
      </footer>
    </main>
  );
}
