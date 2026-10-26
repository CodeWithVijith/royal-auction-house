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
  const [{ auction }, data] = await Promise.all([
    serverApi<{ auction: Auction }>('/auctions/' + encodeURIComponent(id)),
    serverApi<{ players: ComponentProps<typeof PlayersList>['players'] }>(
      '/auctions/' + encodeURIComponent(id) + '/players',
    ),
  ]);
  return (
    <main className="py-8 sm:py-10">
      <p className="eyebrow">Roster management</p>
      <h1 className="page-heading mt-3">Players</h1>
      <PlayersList
        id={id}
        players={data.players}
        locked={auction.status !== 'DRAFT'}
      />
    </main>
  );
}
