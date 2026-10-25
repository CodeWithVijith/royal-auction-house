import { PlayersList } from '@/components/players-list';
import { serverApi } from '@/lib/api';
import type { Auction } from '@sports/shared';
import type { ComponentProps } from 'react';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { auction } = await serverApi<{ auction: Auction }>(
    '/auctions/' + encodeURIComponent(id),
  );
  const data = await serverApi<{
    players: ComponentProps<typeof PlayersList>['players'];
  }>('/auctions/' + encodeURIComponent(id) + '/players');
  return (
    <main className="py-10">
      <h1 className="text-4xl font-semibold">Players</h1>
      <PlayersList
        id={id}
        players={data.players}
        locked={auction.status !== 'DRAFT'}
      />
    </main>
  );
}
