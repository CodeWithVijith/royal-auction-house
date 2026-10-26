import { TeamManager, type Team } from '@/components/team-manager';
import { serverApi } from '@/lib/api';
import type { Auction } from '@sports/shared';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ auction }, data] = await Promise.all([
    serverApi<{ auction: Auction }>('/auctions/' + encodeURIComponent(id)),
    serverApi<{ teams: Team[]; denomination: string }>(
      '/auctions/' + encodeURIComponent(id) + '/teams',
    ),
  ]);
  return (
    <main className="py-8 sm:py-10">
      <p className="eyebrow">Competition management</p>
      <h1 className="page-heading mt-3">Teams</h1>
      <TeamManager
        id={id}
        teams={data.teams}
        denomination={data.denomination}
        locked={auction.status !== 'DRAFT'}
        defaultBudget={auction.defaultBudget}
        defaultSlots={auction.defaultSlots}
      />
    </main>
  );
}
