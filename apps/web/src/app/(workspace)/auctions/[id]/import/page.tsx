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
    <main className="py-10">
      <h1 className="text-4xl font-semibold">Import players</h1>
      <ImportPlayers id={id} />
    </main>
  );
}
