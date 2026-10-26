'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  ['overview', 'Overview'],
  ['import', 'Import'],
  ['players', 'Players'],
  ['teams', 'Teams'],
  ['live', 'Auction'],
  ['unsold', 'Unsold'],
  ['results', 'Results'],
  ['settings', 'Settings'],
] as const;

export function AuctionNav({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Auction sections"
      className="-mx-4 overflow-x-auto border-b border-slate-800 px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex min-w-max gap-1 py-3">
        {sections.map(([route, label]) => {
          const href = `/auctions/${id}/${route}`;
          const active = pathname === href;
          return (
            <Link
              key={route}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition sm:text-sm ${active ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
