import { AuctionNav } from '@/components/auction-nav';
export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  return (
    <>
      <AuctionNav id={id} />
      {children}
    </>
  );
}
