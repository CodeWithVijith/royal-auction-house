'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="mb-4 text-2xl">Unable to load the workspace</h1>
      <p className="mb-6 text-slate-400">Try loading the page again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
