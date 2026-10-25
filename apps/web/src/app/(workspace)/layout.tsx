import Link from 'next/link';
import type { Organizer } from '@sports/shared';
import { serverApi } from '@/lib/api';
import { LogoutButton } from '@/components/logout-button';
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await serverApi<{ user: Organizer }>('/auth/me');
  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-5">
        <Link href="/dashboard" className="font-bold">
          SPORTS <span className="text-amber-300">/</span> AUCTION
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
