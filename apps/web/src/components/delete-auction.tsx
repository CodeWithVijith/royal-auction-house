'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
export function DeleteAuction({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-14 max-w-3xl border-t border-slate-700 pt-8">
      <h2 className="text-xl font-semibold">Delete draft auction</h2>
      <p className="mt-3 text-sm text-slate-400">
        This removes the draft and records the deletion in the audit trail. Type
        the auction name to confirm.
      </p>
      <label className="mt-5 block text-sm">
        Confirm auction name
        <input
          className="field mt-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button
        className="mt-5 bg-red-300 hover:bg-red-200"
        disabled={text !== name || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await mutate('/auctions/' + id, 'DELETE');
            router.replace('/dashboard');
            router.refresh();
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Delete failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Deleting...' : 'Delete auction'}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
