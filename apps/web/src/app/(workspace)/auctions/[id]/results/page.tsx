import { ResultsView, type Results } from '@/components/results-view';
import { serverApi } from '@/lib/api';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverApi<Results>(
    '/auctions/' + encodeURIComponent(id) + '/results',
  );
  return <ResultsView id={id} data={data} />;
}
