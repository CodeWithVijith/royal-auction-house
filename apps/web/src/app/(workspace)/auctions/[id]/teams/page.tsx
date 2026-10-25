import { TeamManager, type Team } from '@/components/team-manager';
import { serverApi } from '@/lib/api';
import type { Auction } from '@sports/shared';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { auction } = await serverApi<{ auction: Auction }>(
    '/auctions/' + encodeURIComponent(id),
  );
  const data = await serverApi<{ teams: Team[]; denomination: string }>(
    '/auctions/' + encodeURIComponent(id) + '/teams',
  );
  return (
    <main className="py-10">
      <h1 className="text-4xl font-semibold">Teams and budgets</h1>
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
