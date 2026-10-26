import { AuctionForm } from '@/components/auction-form';
export default function Page() {
  return (
    <main className="py-8 sm:py-10">
      <p className="eyebrow">Set the stage</p>
      <h1 className="page-heading mt-3">Create Auction</h1>
      <p className="mt-4 text-slate-400">
        Set the essentials for your tournament. Team defaults can be adjusted
        before the auction begins.
      </p>
      <AuctionForm />
    </main>
  );
}
