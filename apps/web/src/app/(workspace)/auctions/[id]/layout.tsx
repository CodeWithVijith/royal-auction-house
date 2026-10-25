import Link from 'next/link';
export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  return (
    <>
      <nav
        aria-label="Auction sections"
        className="mt-6 flex gap-3 overflow-x-auto border-b border-slate-700 pb-4"
      >
        {[
          'overview',
          'import',
          'players',
          'teams',
          'live',
          'unsold',
          'results',
          'settings',
        ].map((route) => (
          <Link
            className="whitespace-nowrap rounded-lg px-3 py-3 text-sm capitalize text-amber-200 hover:bg-slate-800"
            key={route}
            href={'/auctions/' + id + '/' + route}
          >
            {route === 'import' ? 'Import players' : route}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
