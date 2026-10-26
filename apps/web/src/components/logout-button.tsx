'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/lib/client-api';
export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        disabled={busy}
        className="min-h-10 rounded-full border border-amber-500/40 bg-black px-4 text-sm font-bold text-slate-200 transition hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await mutate('/auth/logout', 'POST');
            router.replace('/login');
            router.refresh();
          } catch {
            setError('Sign out failed. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '...' : 'Admin'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
