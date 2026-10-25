import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-3xl font-semibold">Auction not found</h1>
      <p className="mt-5 text-slate-400">
        This auction is unavailable or belongs to another organizer.
      </p>
      <Link href="/dashboard" className="action mt-7 inline-block">
        My auctions
      </Link>
    </main>
  );
}
