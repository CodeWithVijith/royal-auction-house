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
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      <section className="relative w-full max-w-md">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 opacity-20 blur" />
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
          <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pb-5 pt-7 text-center sm:px-8 sm:pt-8">
            <Link
              href="/"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-2xl font-black text-white shadow-lg shadow-amber-500/20"
              aria-label="Sports Auction home"
            >
              A
            </Link>
            <p className="mt-4 text-xs font-bold tracking-[0.2em] text-amber-400">
              SPORTS AUCTION
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              {register ? 'Create your account' : 'Welcome Back'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {register
                ? 'Set up your organizer workspace'
                : 'Sign in to access your auction dashboard'}
            </p>
          </header>
          <form onSubmit={submit} className="space-y-4 px-6 py-6 sm:px-8">
            {register && (
              <label className="block text-sm">
                <span className="font-medium text-slate-300">Your name</span>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  className="field mt-2"
                  placeholder="Organizer name"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="font-medium text-slate-300">Email Address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                className="field mt-2"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-300">Password</span>
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                className="field mt-2"
                placeholder="Enter your password"
              />
            </label>
            {register && (
              <p className="text-xs text-slate-400">
                Use at least 12 characters.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/40 p-3 text-sm text-red-200"
              >
                {error}
              </p>
            )}
            <Button className="mt-2 w-full" disabled={busy} type="submit">
              {busy
                ? 'Please wait...'
                : register
                  ? 'Create account'
                  : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">
          {register ? 'Already have an account?' : 'New to Sports Auction?'}{' '}
          <Link
            className="text-amber-300 underline"
            href={register ? '/login' : '/register'}
          >
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  );
}
