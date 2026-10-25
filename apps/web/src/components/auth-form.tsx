'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mutate } from '@/lib/client-api';
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await mutate('/auth/' + mode, 'POST', {
        email: data.get('email'),
        password: data.get('password'),
        ...(register ? { name: data.get('name') } : {}),
      });
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link href="/" className="font-bold text-amber-300">
        SPORTS / AUCTION
      </Link>
      <p className="mt-12 text-xs uppercase tracking-widest text-slate-400">
        Organizer access
      </p>
      <h1 className="mt-3 text-4xl font-semibold">
        {register ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-4 text-slate-400">
        {register
          ? 'Make room for your next great auction.'
          : 'Sign in to manage your auctions.'}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {register && (
          <label className="block text-sm">
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              className="field mt-2"
            />
          </label>
        )}
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="field mt-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={register ? 12 : 1}
            maxLength={128}
            className="field mt-2"
          />
        </label>
        {register && (
          <p className="text-xs text-slate-400">Use at least 12 characters.</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-400/40 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-400">
        {register ? 'Already have an account?' : 'New to Sports Auction?'}{' '}
        <Link
          className="text-amber-300 underline"
          href={register ? '/login' : '/register'}
        >
          {register ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </main>
  );
}
