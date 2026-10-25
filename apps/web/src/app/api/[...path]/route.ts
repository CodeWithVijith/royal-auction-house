import type { NextRequest } from 'next/server';
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const route = (await context.params).path.join('/');
  if (
    !new RegExp(
      '^(auth/(register|login|logout|me)|auctions(/[a-f0-9-]{36}(/(imports/(upload|preview|commit)|players(/[a-f0-9-]{36})?|teams(/[a-f0-9-]{36})?|assets(/[a-f0-9-]{36})?|live(/(start|spin|decision|pause|resume|settings|correct))?|rounds/unsold|complete|results|export|events))?)?)$',
    ).test(route)
  )
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    let body: ArrayBuffer | undefined;
    const binary =
      request.headers.get('content-type') === 'application/octet-stream';
    if (!['GET', 'HEAD'].includes(request.method)) {
      const reader = request.body?.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > (binary ? 5 * 1024 * 1024 : 32768)) {
            await reader.cancel();
            return Response.json(
              { error: 'PAYLOAD_TOO_LARGE' },
              { status: 413 },
            );
          }
          chunks.push(value);
        }
      }
      body = new Uint8Array(Buffer.concat(chunks)).buffer;
    }
    const headers = new Headers({
      'Content-Type': binary ? 'application/octet-stream' : 'application/json',
      cookie: request.cookies.get('sports_session')
        ? 'sports_session=' + request.cookies.get('sports_session')!.value
        : '',
      origin: request.headers.get('origin') ?? '',
    });
    const response = await fetch(
      new URL(
        '/' + route + request.nextUrl.search,
        process.env.API_URL ?? 'http://localhost:4000',
      ),
      {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      },
    );
    const output = new Headers({ 'Cache-Control': 'no-store' });
    output.set(
      'Content-Type',
      response.headers.get('content-type') ?? 'application/json',
    );
    for (const value of response.headers.getSetCookie())
      output.append('Set-Cookie', value);
    const disposition = response.headers.get('content-disposition');
    if (disposition) output.set('Content-Disposition', disposition);
    return new Response(response.body, {
      status: response.status,
      headers: output,
    });
  } catch {
    return Response.json({ error: 'API_UNAVAILABLE' }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
