import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
export async function serverApi<T>(path: string): Promise<T> {
  const token = (await cookies()).get('sports_session')?.value;
  const response = await fetch(
    new URL(path, process.env.API_URL ?? 'http://localhost:4000'),
    {
      headers: { cookie: token ? 'sports_session=' + token : '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    },
  );
  if (response.status === 401) redirect('/login');
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error('The API is unavailable. Please try again.');
  return response.json() as Promise<T>;
}
