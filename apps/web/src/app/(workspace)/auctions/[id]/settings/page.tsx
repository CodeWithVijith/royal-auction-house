import type { Auction } from '@sports/shared';
import { serverApi } from '@/lib/api';
import { AuctionForm } from '@/components/auction-form';
import { DeleteAuction } from '@/components/delete-auction';
import Link from 'next/link';
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
      <Link
        href={'/auctions/' + auction.id + '/overview'}
        className="text-sm text-amber-300 underline"
      >
        Back to overview
      </Link>
      <h1 className="mt-8 text-4xl font-semibold">Auction settings</h1>
      {auction.status === 'DRAFT' ? (
        <>
          <AuctionForm auction={auction} />
          <DeleteAuction id={auction.id} name={auction.name} />
        </>
      ) : (
        <p className="mt-6 text-slate-400">
          Settings are locked because this auction has started.
        </p>
      )}
    </main>
  );
}
