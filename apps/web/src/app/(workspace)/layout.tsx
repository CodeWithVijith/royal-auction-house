import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { WorkspaceHeader } from '@/components/workspace-header';
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await cookies()).has('sports_session')) redirect('/login');
  return (
    <div className="min-h-dvh">
      <WorkspaceHeader />
      <div className="w-full px-4 sm:px-6 lg:px-4">{children}</div>
    </div>
  );
}
