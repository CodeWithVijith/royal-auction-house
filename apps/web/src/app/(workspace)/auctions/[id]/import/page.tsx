import { ImportPlayers } from '@/components/import-players';
import { serverApi } from '@/lib/api';
import type { Auction } from '@sports/shared';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await serverApi<{ auction: Auction }>('/auctions/' + encodeURIComponent(id));
  return (
    <main className="py-8 sm:py-10">
      <p className="eyebrow">Registration data</p>
      <h1 className="page-heading mt-3">Import Players</h1>
      <ImportPlayers id={id} />
    </main>
  );
}
