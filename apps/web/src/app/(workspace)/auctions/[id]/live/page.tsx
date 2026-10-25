import { LiveAuction } from '@/components/live-auction';
import { serverApi } from '@/lib/api';
import type { LiveState } from '@/lib/live-types';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverApi<LiveState>(
    '/auctions/' + encodeURIComponent(id) + '/live',
  );
  return <LiveAuction id={id} initial={data} />;
}
