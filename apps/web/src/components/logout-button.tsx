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
        className="secondary-action disabled:opacity-50"
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
        {busy ? 'Signing out...' : 'Sign out'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
