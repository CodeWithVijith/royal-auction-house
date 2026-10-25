import { AuctionForm } from '@/components/auction-form';
export default function Page() {
  return (
    <main className="py-12">
      <p className="text-xs tracking-widest text-amber-300">SET THE STAGE</p>
      <h1 className="mt-3 text-4xl font-semibold">Create auction</h1>
      <p className="mt-4 text-slate-400">
        Set the essentials for your tournament. Team defaults can be adjusted
        before the auction begins.
      </p>
      <AuctionForm />
    </main>
  );
}
