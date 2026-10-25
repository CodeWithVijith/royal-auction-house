'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Auction } from '@sports/shared';
import { createAuctionSchema } from '@sports/shared';
import { mutate } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
export function AuctionForm({ auction }: { auction?: Auction }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const form = new FormData(event.currentTarget);
    const input = {
      name: form.get('name'),
      sport: form.get('sport'),
      denomination: form.get('denomination'),
      defaultBudget: Number(form.get('defaultBudget')),
      defaultSlots: Number(form.get('defaultSlots')),
      minimumPrice:
        form.get('minimumPrice') === ''
          ? null
          : Number(form.get('minimumPrice')),
      logoUrl: form.get('logoUrl') || null,
    };
    const parsed = createAuctionSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your form values.');
      setBusy(false);
      return;
    }
    try {
      const result = await mutate(
        auction ? '/auctions/' + auction.id : '/auctions',
        auction ? 'PATCH' : 'POST',
        { ...parsed.data, ...(auction ? { version: auction.version } : {}) },
      );
      if (auction) {
        setSuccess('Auction settings saved.');
        router.refresh();
      } else {
        router.push('/auctions/' + result.auction.id + '/overview');
        router.refresh();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to save auction.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-8 grid max-w-3xl gap-6 sm:grid-cols-2"
    >
      <label className="block text-sm sm:col-span-2">
        Auction name
        <input
          className="field mt-2"
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={auction?.name}
        />
      </label>
      <label className="block text-sm">
        Sport
        <input
          className="field mt-2"
          name="sport"
          required
          minLength={2}
          maxLength={60}
          defaultValue={auction?.sport}
          placeholder="e.g. Cricket"
        />
      </label>
      <label className="block text-sm">
        Denomination
        <select
          className="field mt-2"
          name="denomination"
          defaultValue={auction?.denomination ?? 'INR'}
        >
          <option value="INR">INR (rupees)</option>
          <option value="POINTS">Points</option>
        </select>
      </label>
      <label className="block text-sm">
        Default team budget
        <input
          className="field mt-2"
          name="defaultBudget"
          type="number"
          required
          min={0}
          step={1}
          max={Number.MAX_SAFE_INTEGER}
          defaultValue={auction?.defaultBudget ?? 100000}
        />
      </label>
      <label className="block text-sm">
        Default roster slots
        <input
          className="field mt-2"
          name="defaultSlots"
          type="number"
          required
          min={1}
          max={1000}
          step={1}
          defaultValue={auction?.defaultSlots ?? 15}
        />
      </label>
      <label className="block text-sm">
        Minimum price (optional)
        <input
          className="field mt-2"
          name="minimumPrice"
          type="number"
          min={0}
          step={1}
          max={Number.MAX_SAFE_INTEGER}
          defaultValue={auction?.minimumPrice ?? ''}
        />
      </label>
      <label className="block text-sm">
        Logo URL (optional)
        <input
          className="field mt-2"
          name="logoUrl"
          type="url"
          placeholder="https://"
          maxLength={2048}
          defaultValue={auction?.logoUrl ?? ''}
        />
      </label>
      <p className="text-sm leading-6 text-slate-400 sm:col-span-2">
        Budgets and prices use whole units. The denomination and settings lock
        when the auction starts.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-200 sm:col-span-2">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-emerald-300 sm:col-span-2">
          {success}
        </p>
      )}
      <Button type="submit" disabled={busy} className="justify-self-start">
        {busy ? 'Saving...' : auction ? 'Save settings' : 'Create auction'}
      </Button>
    </form>
  );
}
