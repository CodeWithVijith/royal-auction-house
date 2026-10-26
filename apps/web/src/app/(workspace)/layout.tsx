import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await cookies()).has('sports_session')) redirect('/login');
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-amber-500/25 bg-black/90 backdrop-blur-xl">
        <div className="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <Link
            href="/dashboard"
            className="min-w-0 font-bold tracking-wide text-white"
          >
            <span className="block font-serif text-xl tracking-[0.08em] sm:text-2xl">
              <span className="text-amber-400">SPORTS</span> AUCTION
            </span>
            <span className="hidden text-[10px] font-medium tracking-[0.28em] text-amber-400/80 sm:block">
              PREMIER AUCTION HOUSE
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-slate-400 sm:inline">
              Organizer
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="w-full px-4 sm:px-6 lg:px-4">{children}</div>
    </div>
  );
}
