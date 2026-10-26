'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';

const sections = [
  ['live', 'Auction'],
  ['teams', 'Teams'],
  ['players', 'Players'],
  ['unsold', 'Unsold'],
  ['results', 'Results'],
] as const;

export function WorkspaceHeader() {
  const pathname = usePathname();
  const id = pathname.match(/^\/auctions\/([^/]+)/)?.[1];
  return (
    <header className="sticky top-0 z-40 border-b border-amber-500/30 bg-[#060606]/95 shadow-xl shadow-black/30 backdrop-blur-xl">
      <div className="flex min-h-[82px] w-full items-center gap-4 px-4 sm:px-7 lg:px-9">
        <Link
          href="/dashboard"
          className="flex min-w-0 shrink-0 items-center gap-3"
        >
          <span className="flex h-11 w-10 items-center justify-center rounded-b-xl border border-amber-400/50 bg-gradient-to-b from-amber-300 to-amber-600 font-serif text-sm font-black text-black shadow-lg shadow-amber-500/20">
            RA
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-xl font-bold tracking-[0.08em] text-amber-200 sm:text-3xl">
              ROYAL AUCTION
            </span>
            <span className="hidden text-[10px] font-semibold tracking-[0.28em] text-amber-400/80 sm:block">
              PREMIER SPORTS AUCTION HOUSE
            </span>
          </span>
        </Link>
        {id && id !== 'new' && (
          <nav
            aria-label="Primary auction navigation"
            className="ml-auto hidden items-center gap-2 lg:flex"
          >
            {sections.map(([route, label]) => {
              const href = `/auctions/${id}/${route}`;
              const active = pathname === href;
              return (
                <Link
                  key={route}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-xl px-5 py-3 text-sm font-black uppercase tracking-wider transition ${active ? 'border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-amber-900/20 text-amber-300 shadow-lg shadow-amber-500/10' : 'text-slate-200 hover:bg-white/5 hover:text-amber-300'}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-400 bg-black font-serif font-black text-amber-300">
            A
          </span>
          <LogoutButton />
        </div>
      </div>
      {id && id !== 'new' && (
        <nav
          aria-label="Mobile auction navigation"
          className="overflow-x-auto border-t border-amber-500/15 px-3 [scrollbar-width:none] lg:hidden"
        >
          <div className="flex min-w-max gap-1 py-2">
            {sections.map(([route, label]) => {
              const href = `/auctions/${id}/${route}`;
              const active = pathname === href;
              return (
                <Link
                  key={route}
                  href={href}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide ${active ? 'bg-amber-500/15 text-amber-300' : 'text-slate-300'}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
